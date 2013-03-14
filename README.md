js-xml-rpc
==========

Introduction
------------

Some times ago, I had to write a lightweight client on top of old XML-RPC
exposed by a server. I took the opportunity to write a JavaScript project
following the guidelines provided by the excellent book by Douglas Crockford
"JavaScript: The Good Parts".

The specification of the protocol can be found here: 
__ http://xmlrpc.scripting.com/spec.html

This client is a try to:

    - provide a simple API to call remote services via XML-RPC protocol
    - make code that respect JSLint rules

Here are the main limitations:

    - the remote services have to be hosted on the same domain because of
      security limitations.
    - the only supported browsers are Firefox & Chrome
    - base64 type is not supported


I give it to the community if someone want to fork it and improve it.

Example of usage
----------------

Let's imagine we have a remote server dedicated to the login. This one takes a
couple (login, password) and return a security token if the login successed or
null otherwise.

First, you will have to import the script somehow. Hereafter is an example when
included from HTML page. ::
    
    <!DOCTYPE>
    <html>
      <head>
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <title>My title</title>
        <link rel="stylesheet" type="text/css" href="css/main.css" />
        <script type="text/javascript" src="js/xmlrpc.js"></script>
        <script type="text/javascript" src="js/main.js"></script>
      </head>
      <body>
        ...
      </body>
    </html>

The library is packaged in xmlrpc.js file. We will write code in main.js. In
this last file we will instanciate a XML-RPC client and call the login
webservice. ::

    client = STAC.libXmlRpc.client.xmlrpcClient({path:"/RPC2"}),
    token = client.invokeMethod("loginService", "login", "password");
    // Pass the token to the secured services.

In the last excerpt, we invoked the service named "loginService" and passed it
the login and the password.

Note that the type of argument is handled by the library. For instance, if you
have a service that an object and an integer, you will only have to pass them
as it was a local function: ::

    client.invokeMethod("aService", oAnObject, 47)

Don't hesitate to fork this project, but I also know that almost nobody use
this protocol today. But who knows ? Maybe someone will need it...
