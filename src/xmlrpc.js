/**
 * A XML-RPC client. This one follows the specification at:
 *
 * http://xmlrpc.scripting.com/spec.
 *
 * @author Laurent Stacul (stac_agenais@yahoo.fr)
 * @version 1.0
 */

/*global XMLHttpRequest: false, DOMParser: false, XMLSerializer: false,
  Node: false*/

"use strict";
var STAC = STAC || {};
STAC.libXmlRpc = STAC.libXmlRpc || {};
STAC.libXmlRpc.client = STAC.libXmlRpc.client || {};
STAC.libXmlRpc.marshal = STAC.libXmlRpc.marshaller || {};

STAC.libXmlRpc.marshaller = (function () {
    var NAME = "name",
        VALUE = "value",
        INT = "int",
        I4 = "i4",
        BOOLEAN = "boolean",
        STRING = "string",
        DOUBLE = "double",
        DATE = "dateTime.iso8601",
        BASE64 = "base64",
        STRUCT = "struct",
        MEMBER = "member",
        ARRAY = "array",
        DATA = "data",
        NIL = "nil",

        isScalar = function (parameter) {
            return parameter === null ||
                typeof parameter === "string" ||
                typeof parameter === "boolean" ||
                typeof parameter === "number" ||
                (typeof parameter === "object" &&
                 parameter instanceof Date);
        },
        marshallScalar = function (p, doc) {
            var ret = null;
            if (p === null) {
                ret = doc.createElement(NIL);
            } else if (typeof p === "string") {
                ret = doc.createElement(STRING);
                ret.appendChild(doc.createTextNode(p));
            } else if (typeof p === "boolean") {
                ret = doc.createElement(BOOLEAN);
                ret.appendChild(doc.createTextNode(p ? "1" : "2"));
            } else if (typeof p === "number") {
                //try to determine the type between int or double.
                if (Math.floor(p) === p) {
                    // It is an integer
                    ret = doc.createElement(I4);
                    ret.appendChild(doc.createTextNode(p));
                } else {
                    ret = doc.createElement(DOUBLE);
                    ret.appendChild(doc.createTextNode(p));
                }
            } else if (typeof p === "object" && p instanceof Date) {
                ret = doc.createElement(DATE);
                ret.appendChild(doc.createTextNode(p.toISOString()));
            }
            // TODO Base64 type
            return ret;
        },
        marshallSingleParam, /* defined later to avoid JSLint error */
        marshallArray = function (array, doc) {
            var ret = doc.createElement(ARRAY),
                dataNode = doc.createElement(DATA),
                length = array.length,
                i,
                el;
            ret.appendChild(dataNode);
            for (i = 0; i < length; i += 1) {
                el = array[i];
                dataNode.appendChild(marshallSingleParam(el, doc));
            }
            return ret;
        },
        marshallObject = function (obj, doc) {
            var ret = doc.createElement(STRUCT),
                memberNode,
                nameNode,
                m;
            for (m in obj) {
                // We only take the data element. Inherited data are not
                // taken.
                if (obj.hasOwnProperty(m) && typeof obj[m] !== "function") {
                    memberNode = doc.createElement(MEMBER);
                    nameNode = doc.createElement(NAME);
                    nameNode.appendChild(doc.createTextNode(m));
                    memberNode.appendChild(nameNode);
                    memberNode.appendChild(marshallSingleParam(obj[m], doc));
                    ret.appendChild(memberNode);
                }
            }
            return ret;
        },
        marshallParam = function (param) {
            var i = 0,
                parser = new DOMParser(),
                initialStr = "<" + VALUE + "/>",
                doc = parser.parseFromString(initialStr, "text/xml"),
                nodeRet = doc.getElementsByTagName(VALUE)[0];
            if (isScalar(param)) {
                nodeRet.appendChild(marshallScalar(param, doc));
            } else {
                if (Array.isArray(param)) {
                    nodeRet.appendChild(marshallArray(param, doc));
                } else {
                    nodeRet.appendChild(marshallObject(param, doc));
                }
            }
            return nodeRet;
        },
        UnmarshallError = (function () {
            var cons = function (nodeName) {
                this.errorNode = nodeName;
                this.message = "Unmarshall Error on tag: " + nodeName;
            };
            cons.prototype = new Error();
            return cons;
        }()),
        unmarshallParam = function (node) {
            // node should be positioned on a <value> tag.
            var ret,
                i,
                j,
                memberNode,
                nodeList,
                length,
                currentNode,
                nodeName,
                innerNodes,
                dataNode,
                valueNodes,
                valueNode,
                name,
                value,
                l;
            // If node is null of not defined, throws an UnmarshallError.
            if (!node) {
                throw new UnmarshallError("undefined");
            }

            nodeList = node.childNodes;
            length = nodeList.length;
            currentNode = nodeList[0];

            // Find the first Element. Depending on the underlying string,
            // there could be some TEXT_NODE around.
            i = 0;
            while (currentNode.nodeType !== 1 && i < length) {
                i += 1;
                currentNode = nodeList[i];
            }
            nodeName = currentNode.nodeName;

            switch (nodeName) {
            case I4:
            case INT:
                ret = parseInt(currentNode.firstChild.nodeValue, 10);
                break;
            case DOUBLE:
                ret = parseFloat(currentNode.firstChild.nodeValue);
                break;
            case STRING:
                ret = currentNode.firstChild.nodeValue;
                break;
            case BOOLEAN:
                ret = (currentNode.firstChild.nodeValue === "1");
                break;
            case DATE:
                ret = new Date(currentNode.firstChild.nodeValue);
                break;
            case ARRAY:
                ret = [];
                // <data>
                dataNode = currentNode.getElementsByTagName(DATA)[0];
                valueNodes = dataNode.childNodes;
                l = valueNodes.length;
                j = 0;
                for (i = 0; i < l; i += 1) {
                    valueNode = valueNodes[i];
                    if (valueNode.nodeType === Node.ELEMENT_NODE &&
                            valueNode.nodeName === VALUE) {
                        ret[j] = unmarshallParam(valueNodes[i]);
                        j += 1;
                    }
                }
                break;
            case NIL:
                ret = null;
                break;
            case STRUCT:
                // Current node should be <struct>.
                ret = {};
                innerNodes = currentNode.childNodes;
                // <member>
                for (i = 0; i < innerNodes.length; i += 1) {
                    // Looping over <member>
                    memberNode = innerNodes[i];
                    if (memberNode.nodeType === Node.ELEMENT_NODE &&
                            memberNode.nodeName === MEMBER) {
                        name = memberNode.getElementsByTagName(NAME)[0];
                        name = name.childNodes[0].nodeValue;
                        value = memberNode.getElementsByTagName(VALUE)[0];
                        value = unmarshallParam(value);
                        ret[name.trim()] = value;
                    }
                }
                break;
            default:
                throw new UnmarshallError(nodeName);
            }
            return ret;
        };

    marshallSingleParam = function (param, doc) {
        var ret = doc.createElement(VALUE);
        if (isScalar(param)) {
            ret.appendChild(marshallScalar(param, doc));
        } else if (Array.isArray(param)) {
            ret.appendChild(marshallArray(param, doc));
        } else {
            ret.appendChild(marshallObject(param, doc));
        }
        return ret;
    };

    return { // XML-RPC MARSHALLING API
        /**
         * Converts single function parameter, converts it into a XML Node
         * representation of the XML-RPC.
         *
         * @param {any} of any javascript types.
         * @return {XMLNode} XML-RPC string.
         */
        marshall : marshallParam,

        /**
         * Converts a XML Node into one of the basic Javascript types.
         *
         * @param {XMLNode} The first <value> tag of the XML-RPC message.
         * @return {any} The unmashalled object or javascript primitive.
         * @throws {UnmarshallError} if the XML contains unknown node name.
         */
        unmarshall : unmarshallParam,

        /**
         * Error raised during unmarshalling process, in case the process
         * fails. The root cause can be an unknown node in the XML to
         * unmarshall.
         *
         * @constructor
         * @this {UnmarshallError}
         * @param {string} the in-error node name.
         */
        UnmarshallError : UnmarshallError
    };
}());

STAC.libXmlRpc.client = (function () {
    var marshallParam = STAC.libXmlRpc.marshaller.marshall,
        unmarshallParam = STAC.libXmlRpc.marshaller.unmarshall,
        METHOD_CALL = "methodCall",
        METHOD_NAME = "methodName",
        METHOD_RESPONSE = "methodResponse",
        PARAMS = "params",
        PARAM = "param",
        FAULT = "fault",
        VALUE = "value",

        HttpError = (function () {
            var cons = function (httpStatus) {
                    this.httpStatus = httpStatus;
                    this.message = "HTTP error occured: " + httpStatus;
                };
            cons.prototype = new Error();
            return cons;
        }()),

        FaultError = (function () {
            var cons = function (faultCode, faultString) {
                    this.faultCode = faultCode;
                    this.faultString = faultString;
                };
            cons.prototype = new Error("XML-RPC fault occured");
            return cons;
        }()),

        xmlrpcClient = function (spec) {
            var that = {},
                serializer = new XMLSerializer(),

                marshall = function (args) {
                    var parser = new DOMParser(),
                        doc = parser.parseFromString("", "text/xml"),
                        methodCallNode = doc.createElement(METHOD_CALL),
                        methodNameNode = doc.createElement(METHOD_NAME),
                        paramsNode = doc.createElement(PARAMS),
                        paramNode = null,
                        params = Array.prototype.slice.apply(args, [1]),
                        paramsNumber = params.length,
                        i = 0;
                    methodNameNode.appendChild(doc.createTextNode(args[0]));
                    methodCallNode.appendChild(methodNameNode);
                    for (i = 0; i < paramsNumber; i += 1) {
                        paramNode = doc.createElement(PARAM);
                        paramNode.appendChild(marshallParam(params[i]));
                        paramsNode.appendChild(paramNode);
                    }
                    methodCallNode.appendChild(paramsNode);

                    return methodCallNode;
                },
                unmarshall = function (strResponse) {
                    var parser = new DOMParser(),
                        xmlDoc = parser.parseFromString(strResponse, "text/xml"),
                        xmlRoot = xmlDoc.getElementsByTagName(METHOD_RESPONSE)[0],
                        node,
                        error,
                        ret;

                    if (xmlRoot.getElementsByTagName(PARAMS).length === 0) {
                        node = xmlRoot.getElementsByTagName(FAULT)[0];
                        node = node.getElementsByTagName(VALUE)[0];
                        ret = unmarshallParam(node);
                        throw new FaultError(ret.faultCode, ret.faultString);
                    } else {
                        node = xmlRoot.getElementsByTagName(PARAMS)[0];
                        node = node.getElementsByTagName(PARAM)[0];
                        node = node.getElementsByTagName(VALUE)[0];
                        ret = unmarshallParam(node);
                    }
                    return ret;
                },
                sendRequest = function (strRequest) {
                    var xhr = spec.alternateXhr || new XMLHttpRequest(),
                        e = null;

                    xhr.open("POST", spec.path, false);
                    xhr.setRequestHeader("Content-Type",
                            "text/xml;charset=UTF-8");
                    xhr.send(strRequest);

                    if (xhr.status !== 200) {
                        throw new HttpError(xhr.status);
                    }

                    return xhr.responseText;
                };

            /**
             * Invokes the remote method in XML-RPC. This is a synchronous
             * call made to the server.
             *
             * @param {method} the method name exposed on the server.
             * @param {varargs} the parameters to be passed to the method.
             * @return an unmarshalled value.
             * @throws {HttpError} if HTTP status is not 200.
             * @throws {FaultError} if the server return a Fault, meaning a
             * functional error.
             * @throws {libXmlRpc.marshaller.UnmarshallError} if an error
             * occured during unmarshalling.
             */
            that.invokeMethod = function (method) {/*, ... the params */
                var strRequest = "",
                    strResponse = "",
                    ret = null,
                    oSerializer = new XMLSerializer();

                strRequest = oSerializer.serializeToString(marshall(arguments));
                if (STAC.dbg) {
                    console.log(strRequest);
                }
                strResponse = sendRequest(strRequest);
                if (STAC.dbg) {
                    console.log(strResponse);
                }
                ret = unmarshall(strResponse);
                return ret;
            };

            return that;
        };

    return { // XML-RPC API
        /**
         * Factory method which instantiate the XML-RPC client.
         *
         * @return {object} the XML-RPC client.
         */
        xmlrpcClient : xmlrpcClient,

        /**
         * HTTP level error. This on is generally raised when HTTP status code
         * is different of 200.
         *
         * @constructor
         */
        HttpError : HttpError,

        /**
         * Functional error returned by the server. This represents a errorCode
         * and errorString pair.
         *
         * @constructor
         */
        FaultError : FaultError
    };

}());
