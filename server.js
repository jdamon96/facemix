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

    socket.on('join', function(roomname){
        
    
        /*
        * Get first person in line waiting to chat
        */
        const firstInLine = waitlist[0];


        /*
        * Helper functions
        */

        function getRoomName(client_id, chat_partner_id){
            var roomName = client_id + chat_partner_id;
            return(roomName);
        };

        function createRoomInvitation(client_id, chat_partner_id){

            /* Make unique room name */
            const newRoomName = getRoomName(socket.id, chat_partner_id);

            /* Create room invitation for the chat partner */
            const roominvitation = {
                recipient: chat_partner_id,
                roomname: newRoomName
            }

            return roominvitation;

        }




        /*
        * If there is someone waiting to chat in line:
        
        *   - invite the chat partner to join it

        *   - join it
        
        */
        if(firstInLine){
            waitlist.shift(); // removes firstInLine from the beginning of the array 

            /* Invite the chat partner to a room*/ 
            const roominvitation = createRoomInvitation(socket.id, firstInLine);
            
            socket.broadcast.emit('roominvitation', roominvitation);            

            /* Join the room */ 
            socket.join(roominvitation.roomname);

            socket.emit('message', {
                title: 'room-joined',
                content: {
                    roomname: newRoomName
                }
            });

            /*
            * Send 'roleupdate' event to client to designate their role as HOST 
            * (the implication of this is when the clients have recieved events confirming that both clients are in the room,
            * the designated client role will determine which client creates the RTCPeerConnection offer )
            */

            socket.emit('message', {
                title: 'role-update',
                content: {
                    role: 'HOST'
                }
            });

        } 
        /* 
        * If there's no one else waiting for a chat partner, join the waitlist
        */
        else {
            waitlist.push(socket.id);
            // tell the client it's now waiting
            socket.emit('message', {
                title: 'waiting',
                content: true
            });
        }            
    

    

    });


    /*
    * If the socket joins with a specific roomname 
    *   - check how many clients are in the room specified by roomname
    *   - if 0, join (this shouldn't happen though - if a socket has a specific roomname to join they should be the 2nd to join the room bc the client who created the roominvitation should already be in that room)
    *   - if 1, join
    *   - if 2, reject join (room is full)
    * (note: This socket was the recipient of a roominvitation - that's why they have a specific roomname to join) 
    */ 
    socket.on('joinroom', function(roomname){
    
        /* Get list of socket clients in room 'roomname'*/
        var clients = io.sockets.adapter.rooms[roomname];

        /* Get number of clients in room 'roomname'*/
        var numClients = typeof clients !=='undefined' ? clients.length: 0;

        /* if there are 0 clients currently in the room */
        if(numClients == 0){
            console.log('SERVER: first client joining room');
            socket.room = roomname;
            socket.emit('message', {
                title: 'room-join',
                content: {
                    roomname: roomname
                }
            });
            socket.join(socket.room);
        }
        /* if there is 1 client currently in the room */
        else if (numClients == 1){
            console.log('SERVER: second client joining room');
            socket.join(roomname);
            //io.sockets.in()
            socket.emit('message', {
                title: 'room-join',
                content: {
                    roomname: roomname
                }
            });

            socket.broadcast.to(roomname).emit("message", {
                title: 'room-ready',
                content: {
                    room_population: 2
                }
            });
            
            /* TO-DO: emit event here that instructs
             * the clients to set up an RTC connection 
             * between themselves */ 
        }
        /* if there are 2+ clients currently in the room*/
        else {
            socket.emit('message', {
                title: 'room-full',
                content: socket.room
            });
            console.log('SERVER: room "' + socket.room + '" is full');
        }
    
    });

    socket.on('facemesh', function(msg){
        socket.broadcast.to(msg.room).emit('facemesh', msg.facemesh)
    });

    /*
    * Handles TOKEN event from client sockets
    * - requests token from Twilio, 
        - if Twilio returns a token, the server passes it back to the client in a server-emitted 'token' event
        - if Twilio fails to return a token, the server console.logs the err returned instead
    */
    socket.on('token', function(){
        twilio.tokens.create(function(err, response){
            if(err) {
                console.log(err);
            }
            else {
                console.log('SERVER: returning token to client');
                socket.emit('token', response);
            }
        });
    });

    /*
    * Handles CANDIDATE event from client sockets
    * - The servers relays the CANDIDATE event and data to other sockets in the same room as the original emitting socket
    */
    socket.on('candidate', function(msg){    
        console.log('SERVER: sending candidate to client');
        socket.broadcast.to(msg.room).emit('candidate', msg.candidate);
    });

    /*
    * Handles OFFER event from client sockets
    * - The servers relays the CANDIDATE event and data to other sockets in the same room as the original emitting socket
    */
    socket.on('offer', function(msg){
        console.log('SERVER: sending offer to client');
        socket.broadcast.to(msg.room).emit('offer', msg.offer);
    });

    /*
    * Handles ANSWER event from client sockets
    * - The servers relays the CANDIDATE event and data to other sockets in the same room as the original emitting socket
    */
    socket.on('answer', function(msg){
        console.log('SERVER: sending answer to client');
        socket.broadcast.to(msg.room).emit('answer', msg.answer);
    });

});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});