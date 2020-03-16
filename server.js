// index.js
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

var twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.use(express.static('public'));

io.on('connection', function(socket){

    socket.on('join', function(room){
        
        var clients = io.sockets.adapter.rooms[room];
        var numClients = typeof clients !=='undefined' ? clients.length: 0;

        if(numClients == 0){
            socket.join(room);
        }
        else if (numClients == 1){
            socket.join(room);
            socket.emit('ready', room);
            socket.broadcast.emit('ready', room);
        }
        else {
            socket.emit('full', room);
        }

    });

    socket.on('token', function(){
        twilio.tokens.create(function(err, response){
            if(err) {
                console.log(err);
            }
            else {
                socket.emit('token', response);
            }
        });
    });

    socket.on('candidate', function(candidate){
        socket.broadcast.emit('candidate', candidate);
    });

    socket.on('offer', function(offer){
        socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', function(answer){
        socket.broadcast.emit('answer', answer);
    });

});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});