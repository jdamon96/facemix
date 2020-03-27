// index.js
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;
const LOBBY_NAME = 'main-lobby';

var twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.use(express.static('public'));

let waitlist = [];

io.on('connection', function(socket){


    function getRoomName(id1, id2){
        return (id1 + id2);
    }

    socket.on('join', function(roomname){

        if(!roomname){
            // if there is someone else looking for a chat partner, make a unique room, join it, and invite them to join it
            if(waitlist[0]){
                const chat_partner_id = waitlist[0];

                console.log(chat_partner_id + ' is next on the waitlist');
                waitlist.shift(); // removes the item from the beginning of the array 
                console.log('pairing with ' + chat_partner_id);

                const room_name = getRoomName(socket.id, chat_partner_id);

                const roominvitation = {
                    recipient: chat_partner_id,
                    room_name: room_name
                }

                //client joins the room for them and their chat partner
                socket.join(room_name);
                console.log(socket.id + ' joined room ' + room_name);

                //sends invitation to other sockets w/ recipient details for chat partner to check
                socket.broadcast.emit('roominvitation', roominvitation);

                const roleupdate = {
                    role: 'HOST'
                }

                socket.emit('roleupdate', roleupdate);
                console.log('room invitation sent');
                console.log(roominvitation);


            // if there's no one else waiting for a chat partner, join the waitlist
            } else {
                console.log('Waitlist is empty');
                console.log('Adding ' + socket.id + ' to the waitlist');
                waitlist.push(socket.id);
                // tell the client it's now waiting
                socket.emit('message', {
                    title: 'waiting',
                    content: true
                });
            }            
        }

        if(roomname){
            console.log('roomname: ' + roomname);
            socket.join(roomname);
            const roomjoined = {
                room: roomname,
                newParticipant: socket.id
            }
            socket.to(roomname).emit('roomjoined', roomjoined);
            console.log('Socket room: ' + socket.rooms)
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
        socket.to(socket.rooms[0]).emit('candidate', candidate);
        //socket.broadcast.emit('candidate', candidate);
    });

    socket.on('offer', function(offer){
        socket.to(socket.rooms[0]).emit('offer', offer);
        //socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', function(answer){
        socket.to(socket.rooms[0]).emit('answer', answer);
        //socket.broadcast.emit('answer', answer);
    });

});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});