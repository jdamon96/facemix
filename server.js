// index.js
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

var twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.use(express.static('public'));

http.listen(3000, function() {
  console.log('listening on *:3000');
});