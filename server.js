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

    socket.on('join', function(room_name){

        if(!room_name){
            // if there is someone else looking for a chat partner, make a unique room, join it, and invite them to join it
            if(waitlist[0]){
                const chat_partner_id = waitlist[0];

                console.log(chat_partner_id + ' is next on the waitlist');
                waitlist.shift(); // removes the item from the beginning of the array 
                console.log('pairing with ' + chat_partner_id);

                const new_room_name = getRoomName(socket.id, chat_partner_id);

                const roominvitation = {
                    recipient: chat_partner_id,
                    room_name: new_room_name
                }

                //client joins the room for them and their chat partner
                socket.join(new_room_name);
                console.log(socket.id + ' joined room ' + new_room_name);

                //sends invitation to other sockets w/ recipient details for chat partner to check
                socket.broadcast.emit('roominvitation', roominvitation);
                console.log('room invitation sent')
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

        if(room_name){
            socket.join(room_name);
            console.log(socket.id + ' joined room ' + room_name);
        }
    
/*    
        var clients = io.sockets.adapter.rooms[LOBBY_NAME];
        var numClients = typeof clients !=='undefined' ? clients.length: 0;
        

        io.sockets.in(socket.room).emit().emit('message', {
            title: 'room_count',
            content: numClients 
        });

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

        */



});