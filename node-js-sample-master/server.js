'use strict';

 var WebSocketClient = require('websocket').client;
 var uaa_util = require('predix-uaa-client');
 var url = require('url');

 var tsUrl = 'wss://gateway-predix-data-services.run.aws-usw02-pr.ice.predix.io/v1/stream/messages';
 var uaaUrl = 'https://ea58027d-5e42-4c74-add2-26d80eee3856.predix-uaa.run.aws-usw02-pr.ice.predix.io/oauth/token';
 var clientId = 'uaa-client';
 var clientSecret = 'twin';

 var requestOptions = {
     agent: false
 };

 if(process.env.https_proxy) {
     var proxy = url.parse(process.env.https_proxy);
     var tunnelingAgent = require('tunnel').httpsOverHttp({
       proxy: {
         host: proxy.hostname,
         port: proxy.port
       }
     });

     console.log('Using proxy', proxy);
     requestOptions.agent = tunnelingAgent;
 }

 // Send a timeseries sample on the provided websocket connection
 var sendSample = connection => {
         if (connection.connected) {
                 var number = Math.round(Math.random() * 0xFFFFFF);
                 var data = {
                     "messageId":Date.now(),
                     "body":[
                         {
                             "name":"MachineId:SensorId",
                             "datapoints":[
                                 [Date.now(), number, 3]
                             ],
                             "attributes":{
                                 "host":"server1",
                                 "size": number > 0x7FFFFF ? "Big" : "Small"
                             }
                         }
                     ]
                 };
                 console.log('Sending...', data);
                 connection.sendUTF(JSON.stringify(data));
         } else {
             console.log('Not connected!!');
         }
 };

 uaa_util.getToken(uaaUrl, clientId, clientSecret).then((token) => {

   // Use token.access_token as a Bearer token Authroization header
   // in calls to secured services.
     // All three of these headers are required to time-series ingestion.
     // You can set Origin to whatever you want, but it is needed.
     // Origin can be added manually as a header, or specified as the third
     // parameter to the client.connect call.
     console.log(token);
     var headers = {
         Authorization: 'Bearer ' + token.access_token,
         'predix-zone-id': '0c8f7d5c-b3b4-46e3-8f05-a0f54eb26a1a',
         'Origin': 'ws://localhost:9800/websocket',
         'content-type':'application/json'
     };
     var client = new WebSocketClient();

     client.on('connectFailed', error => {
             console.log('Connect Error: ', error);
     });

     client.on('connect', connection => {
             console.log('WebSocket Client Connected');
             connection.on('error', error => {
                     console.log("Connection Error: " + error.toString());
             });
             connection.on('close', () => {
                     console.log('echo-protocol Connection Closed');
             });
             connection.on('message', message => {
                     if (message.type === 'utf8') {
                             console.log("Received: '" + message.utf8Data + "'");
                     }
             });

             // Send a sample value every second, until the app is stopped
             setInterval(() => { sendSample(connection); }, 1000);
     });

     console.log('connecting with headers', headers);
     // These request options that define the proxy to use can be specified on the WebSocketClient varructor instead.
     // If this option is used, the varructor call would be:
     // var client = new WebSocketClient({ tlsOptions: { agent: tunnelingAgent }});
     // The args here are:
     // wss url, sub-protocol, origin, headers, request options
     client.connect(tsUrl, null, 'ws://localhost:9800/websocket', headers, requestOptions);
 }).catch((err) => {
   console.error('Error getting token', err);
 });
