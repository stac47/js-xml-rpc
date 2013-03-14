var STAC = STAC || {};

STAC.testtools = STAC.testtools || (function() {
    var marshall = STAC.libXmlRpc.marshaller.marshall,
        unmarshall = STAC.libXmlRpc.marshaller.unmarshall,
        serializer = new XMLSerializer(),
        baseXhr = function() {
            var that = {};
            that.open = function() {};
            that.setRequestHeader = function() {};
            that.send = function() {};
            that.status = 200;
            that.responseText = "";
            return that;
        },
        successXhr = function (returnValue) {
            var that = baseXhr(),
                createValue = function(v) {
                    var valueNode = marshall(v),
                        strValue = serializer.serializeToString(valueNode);
                    return strValue;
                };
            that.responseText = '<?xml version="1.0"?>' + 
                                 '<methodResponse><params><param>' +
                                        createValue(returnValue) + 
                                '</param></params></methodResponse>';
            return that;
        },
        faultXhr = function (faultCode, faultString) {
            var that = baseXhr(),
                createValue = function() {
                    var fault = {
                            faultCode : faultCode,
                            faultString : faultString
                        },
                        valueNode = marshall(fault),
                        strValue = serializer.serializeToString(valueNode);
                    return strValue;
                };
            that.responseText = '<?xml version="1.0"?>' + 
                                 '<methodResponse><fault>' +
                                        createValue() + 
                                '</fault></methodResponse>';
            return that;
        },
        errorXhr = function (statusValue) {
            var that = baseXhr();
            that.status = statusValue;
            return that;
        };
    return {
        successXhr : successXhr,
        errorXhr : errorXhr,
        faultXhr : faultXhr
    };
}());

describe("HttpError exception", function () {
    var HttpError = STAC.libXmlRpc.client.HttpError;
        e = new HttpError(404);

    it("should give the HTTP status", function () {
        expect(e.httpStatus).toEqual(404);
    });

    it("should be an Error and HttpError type", function () {
        expect(e instanceof Error).toBeTruthy();
        expect(e instanceof HttpError).toBeTruthy();
    });

    it("should have a defined message", function () {
        expect(e.message).toEqual("HTTP error occured: 404");
    });
});

describe("FaultError exception", function () {
    var FaultError = STAC.libXmlRpc.client.FaultError,
        TOO_MANY_PARAM = "Too many parameters.",
        e = new FaultError(4, TOO_MANY_PARAM);

    it("should give the fault code and message", function () {
        expect(e.faultCode).toEqual(4);
        expect(e.faultString).toEqual(TOO_MANY_PARAM);
    });

    it("should be an Error and FaultError type", function () {
        expect(e instanceof Error).toBeTruthy();
        expect(e instanceof FaultError).toBeTruthy();
    });

    it("should have a defined message", function () {
        expect(e.message).toEqual("XML-RPC fault occured");
    });
});

describe("UnmarshallError exception", function () {
    var UnmarshallError = STAC.libXmlRpc.marshaller.UnmarshallError,
        NODE_IN_ERROR = "fakeNode",
        e = new UnmarshallError(NODE_IN_ERROR);

    it("should give the node in error", function () {
        expect(e.errorNode).toEqual(NODE_IN_ERROR);
    });

    it("should be an Error and UnmarshallError type", function () {
        expect(e instanceof Error).toBeTruthy();
        expect(e instanceof UnmarshallError).toBeTruthy();
    });

    it("should have a defined message", function () {
        expect(e.message).toEqual("Unmarshall Error on tag: " + NODE_IN_ERROR);
    });
});

describe("XML-RPC client", function() {
    var client = STAC.libXmlRpc.client.xmlrpcClient,
        HttpError = STAC.libXmlRpc.client.HttpError,
        FaultError = STAC.libXmlRpc.client.FaultError;

    it ("should send a successfull request", function() {
        var fakeXhr = STAC.testtools.successXhr,
            expValue = "Hello",
            spec = {
                path : "/toto",
                alternateXhr: fakeXhr(expValue)
            },
            c = client(spec),
            response = c.invokeMethod("sayhi", null);
        expect(response).toEqual(expValue);
    });

    it ("should send a successfull complex request", function() {
        var fakeXhr = STAC.testtools.successXhr,
            expValue = {
                tab : [null, 1, "a", {name : "stac"}, [1, 2, 3]],
                b : true,
                i : 15,
                f : 3.14,
                d : new Date()
            },
            spec = {
                path : "/toto",
                alternateXhr: fakeXhr(expValue)
            },
            c = client(spec),
            response = c.invokeMethod("sayhi", null);
        expect(response).toEqual(expValue);
    });

    it ("should send a FaultError in case of an XML-RPC fault", function() {
        var fakeXhr = STAC.testtools.faultXhr,
            TOO_MANY_PARAM = "Too many parameters.",
            spec = {
                path : "/toto",
                alternateXhr: fakeXhr(4, TOO_MANY_PARAM)
            },
            c = client(spec),
            e = new FaultError(4, TOO_MANY_PARAM);
        expect(function() {c.invokeMethod("meth", true, false);}).toThrow(e);
    });

    it ("should send an HttpError in case of an HTTP error", function() {
        var fakeXhr = STAC.testtools.errorXhr,
            spec = {
                path : "/toto",
                alternateXhr: fakeXhr(404)
            },
            c = client(spec),
            e = new HttpError(404);
        expect(function() {c.invokeMethod("sayhi", null);}).toThrow(e);
    });
});

describe("Unmarshalling specificities", function () {
    var unmarshall = STAC.libXmlRpc.marshaller.unmarshall,
        UnmarshallError = STAC.libXmlRpc.marshaller.UnmarshallError,
        parser = new DOMParser();

    it("should unmarshall null whatever the XML is formated", function () {
        var sXml = "<value>\n\t<nil></nil>\n</value>",
            doc = parser.parseFromString(sXml, "text/xml"),
            valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode)).toBeNull();
    });

    it("should unmarshall a boolean whatever the XML is formated", function () {
        var sXml = "<value>\n\t<string>\n\t\tHello\n</string>\n</value>",
            doc = parser.parseFromString(sXml, "text/xml"),
            valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode)).toEqual("\n\t\tHello\n");
    });

    it("should unmarshall a number whatever the XML is formated", function () {
        var sXml = "<value>\n\t<i4>\n\t\t47\n</i4>\n</value>",
            doc = parser.parseFromString(sXml, "text/xml"),
            valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode)).toEqual(47);
    });

    it("should unmarshall a Date whatever the XML is formated", function () {
        var d = new Date(),
            sXml = "",
            doc = null,
            valueNode = null;
        sXml = "<value>\n\t<dateTime.iso8601>\n\t\t"; 
        sXml += d.toUTCString();
        sXml+= "\n</dateTime.iso8601>\n</value>",

        doc = parser.parseFromString(sXml, "text/xml"),
        valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode).toUTCString()).toEqual(d.toUTCString());
    });

    it("should unmarshall an array whatever the XML is formated", function () {
        var sXml = "",
            doc = null,
            valueNode = null,
            expValue = [47, -1, 0];
        sXml = "<value>\n\t<array>\n\t\t<data>\n\t";
        sXml += "<value>\n\t<i4>\n\t\t\t47\n</i4>\n</value>";
        sXml += "<value>\n\t<i4>\n\t\t\t-1\n</i4>\n</value>";
        sXml += "<value>\n\t<i4>\n\t\t\t0\n</i4>\n</value>";
        sXml += "</data>\n\t</array>\n\t\t\t\n</value>";
        doc = parser.parseFromString(sXml, "text/xml"),
        valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode)).toEqual(expValue);
    });

    it("should unmarshall an object whatever the XML is formated", function () {
        var sXml = "",
            doc = null,
            valueNode = null,
            expValue = {a: 47};
        sXml = "<value>\n\t<struct>\n\t\t";
        sXml += "<member>\n\t\t";
        sXml += "<name>\n\t\ta\n</name>";
        sXml += "<value>\n\t<i4>\n\t\t\t47\n</i4>\n</value>";
        sXml += "</member>";
        sXml += "</struct>\n\t</value>";
        doc = parser.parseFromString(sXml, "text/xml"),
        valueNode = doc.getElementsByTagName("value")[0];
        expect(unmarshall(valueNode)).toEqual(expValue);
    });

    it("should throw an UnmarshallError if no node", function () {
        var valueNode,
            fn = function () {
                unmarshall(valueNode);
            };
        expect(fn).toThrow(new UnmarshallError("undefined"));
    });

    it("should throw an UnmarshallError if problems", function () {
        var sXml = "<value>\n\t<error>\n\t\t47\n</error>\n</value>",
            doc = parser.parseFromString(sXml, "text/xml"),
            valueNode = doc.getElementsByTagName("value")[0],
            fn = function () {
                unmarshall(valueNode);
            };
        expect(fn).toThrow(new UnmarshallError("error"));
    });
});

describe("Marshaling process", function() {
    var marshall = STAC.libXmlRpc.marshaller.marshall,
        unmarshall = STAC.libXmlRpc.marshaller.unmarshall;
    
    it("should handle null value", function() {
        var s = null,
            result = unmarshall(marshall(s));
        expect(result).toBeNull()
    });

    it("should handle boolean primitive", function() {
        var p = true,
            result = unmarshall(marshall(p));
        expect(result).toBeTruthy(p);
        p = !p;
        result = unmarshall(marshall(p));
        expect(result).not.toBeTruthy(p);
    });

    it("should handle int primitive", function() {
        var p = [0, 1, -1, 47, -1000],
            result,
            i;
        for (i = 0 ; i < p.length ; i += 1) {
            result = unmarshall(marshall(p[i]));
            expect(result).toEqual(p[i]);
        }
    });

    it("should handle float primitive", function() {
        var p = [0.01, 3.14, -1.0, 47.47, -1000.1],
            result,
            i;
        for (i = 0 ; i < p.length ; i += 1) {
            result = unmarshall(marshall(p[i]));
            expect(result).toEqual(p[i]);
        }
    });

    it("should handle complex string primitive", function() {
        var s = "äÄâÂù*$^&é#\"{([-|è`_çà@)°]=+\\\u2020}",
            result = unmarshall(marshall(s));
        expect(result).toEqual(s);
    });

    it("should handle string primitive", function() {
        var s = "Hello, World !",
            result = unmarshall(marshall(s));
        expect(result).toEqual(s);
    });

    it("should handle Date object", function() {
        var d = new Date();
            result = unmarshall(marshall(d));
        expect(result).toEqual(d);
    });

    it("should handle a simple array", function() {
        var tab = [1, 2, 3],
            result = unmarshall(marshall(tab));
        expect(result).toEqual(tab);
    });

    it("should handle a multi types array", function() {
        var tab = [null, 2, 3.14, "Hello", new Date(), {}],
            result = unmarshall(marshall(tab));
        expect(result).toEqual(tab);
    });

    it("should handle a multi-dimensional array", function() {
        var tab = [[1, 1, 1],
                   [2, 2, 2],
                   [3, 3, 3]];
            result = unmarshall(marshall(tab));
        expect(result).toEqual(tab);
    });

    it("should handle an empty object", function() {
        var o = {},
            result = unmarshall(marshall(o));
        expect(result).toEqual(o);
    });

    it("should handle a simple object", function() {
        var o = {firstname : "Laurent",
                 lastname : "Stac",
                 age: 31,
                 dob: new Date(),
                 disability: null,
                 weight: 65.3};
            result = unmarshall(marshall(o));
        expect(result).toEqual(o);
    });

    it("should handle a complex object", function() {
        var oo = {foo: ["bar", new Date(), [1, null, "baz"]],
                  n: null},
            o = {firstname : "Laurent",
                 lastname : "Stac",
                 age: 31,
                 dob: new Date(),
                 disability: null,
                 weight: 65.3,
                 oList: [[1], {}, new Date(), oo]};
            result = unmarshall(marshall(o));
        expect(result).toEqual(o);
    });

});
