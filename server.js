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

app.use(express.static('dist'));

let serverPopulation = 0;
let waitlist = [];

function clearRoom(roomname){
    io.in(roomname).clients(function(error, socketIds){
        if(error) throw error;
        
        // iterate through all the sockets in the room and instruct them to leave the room
        socketIds.forEach(socketId => {
            io.sockets.sockets[socketId].leave(roomname); 
            io.sockets.sockets[socketId].room = null; //reset socket.room field to null
        });

    });
}

function removeFromWaitlist(socketId) {
    console.log('Removing ', socketId, ' from the waitlist');
    console.log('Waitlist before removal: ', waitlist);
    let index = waitlist.indexOf(socketId);
    if (index > -1) {
        waitlist.splice(index, 1);
    }
    console.log('Waitlist after removal: ', waitlist);
}

io.on('connection', function(socket){

    serverPopulation = (serverPopulation + 1);

    io.sockets.emit('message', {
        title: 'population-update',
        content: {
            population: serverPopulation
        }
    });

    // find a chat partner
    socket.on('join', function(){
        console.log('Waitlist current state: ', waitlist);

        // Get the first person in line
        const firstInLine = waitlist[0];

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
        };

        // If there was someone in line
        if(firstInLine){
            console.log('First in line:');
            console.log(firstInLine);
            // removes firstInLine from the beginning of the array 
            waitlist.shift(); 

            // Invite the chat partner to a room
            const roominvitation = createRoomInvitation(socket.id, firstInLine);
            
            console.log(socket.id, 'broadcasting the following room invitation:', roominvitation);
            socket.broadcast.emit('roominvitation', roominvitation);            

            //this client joins the room
            socket.room = roominvitation.roomname;
            socket.join(socket.room);

            //send message to this client telling it that it is the initiator
            socket.emit('message', {
                title: 'initiator-status',
                content: {
                    initiator: true
                }
            });

            //send message to this client telling it that it has joined a room
            socket.emit('message', {
                title: 'room-joined',
                content: {
                    roomname: roominvitation.roomname
                }
            });
      
        } 

        // if there isn't a chat partner inline, join the line
        else {
            console.log('Adding ' + socket.id + ' to the waitlist');
            waitlist.push(socket.id);    
        }            
    });

    // join a specific room
    socket.on('joinroom', function(roomname){
        console.log(socket.id + ' processing invitation to join room ' + roomname);
        // Get list of clients in the specified room
        let clients = io.sockets.adapter.rooms[roomname];

        // get number of clients
        let numClients = typeof clients !=='undefined' ? clients.length: 0;

        // if there are no clients in the room
        if(numClients == 0){
            console.log('No one in room, emitting room-joined event');
            socket.room = roomname;
            socket.emit('message', {
                title: 'room-joined',
                content: {
                    roomname: roomname
                }
            });
            socket.join(socket.room);
        }
        // if there is another client in the room
        else if (numClients == 1){
            console.log('Second client joining room, emitting room-joined and room-ready events');
            //join the room
            socket.room = roomname;
            socket.join(socket.room);

            //tell this client it joined a room
            socket.emit('message', {
                title: 'room-joined',
                content: {
                    roomname: roomname
                }
            });

            // tell the other client in the room that the room is ready
            socket.broadcast.to(roomname).emit("message", {
                title: 'room-ready',
                content: {
                    room_population: 2
                }
            });
        }
        // if there are 2 clients in the room, tell this client the room is full
        else {
            console.log("!!!! This shouldn't occur. Emitting room-full event because more than 2 clients in the room " + socket.room);
            socket.emit('message', {
                title: 'room-full',
                content: socket.room
            });
        } 
    });

    // Provide client with a Network Traversal Service Token from Twilio 
    // "Twilio’s Network Traversal Service is a globally distributed STUN/TURN service that helps you deploy more reliable peer-to-peer communications applications."
    socket.on('token', function(){
        console.log('Recieved Twilio token request from ' + socket.id);
        twilio.tokens.create(function(err, response){
            if(err) {
                console.log(err);
                socket.emit('error', err)
            }
            else {
                console.log('Returning Twilio token to ' + socket.id);
                //send the token to the requesting client
                socket.emit('token', response);
            }
        });
    });

    // receive 'candidate' from client and relay to the other client in the room
    socket.on('candidate', function(msg){    
        console.log('Sending candidate from', socket.id);
        socket.broadcast.to(msg.room).emit('candidate', msg.candidate);
    });

    socket.on('end-chat', function(){
        console.log(socket.id, 'ended the chat. Removing all clients from room.');

        let roomname = socket.room;
        socket.broadcast.to(roomname).emit('chat-ended');
        clearRoom(roomname);
    });

    // receive 'offer' from client and relay to the other client in the room
    socket.on('offer', function(msg){
        console.log('Sending offer from', socket.id, 'to other socket in the room');
        socket.broadcast.to(msg.room).emit('offer', msg.offer);
    });

    // receive 'answer' from client and relay to the other client in the room
    socket.on('answer', function(msg){
        console.log('Sending answer from', socket.id, 'to other socket in the room');
        socket.broadcast.to(msg.room).emit('answer', msg.answer);
    });

    socket.on('disconnect', function(){

        // update population count on disconnect
        serverPopulation = (serverPopulation - 1);

        io.sockets.emit('message', {
            title: 'population-update',
            content: {
                population: serverPopulation
            }
        });
        removeFromWaitlist(socket.id);


        if(socket.room){
            console.log("One of the clients disconnected from the chat. Removing all clients from the room")
            let roomname = socket.room;
            socket.broadcast.to(roomname).emit('chat-ended');
            clearRoom(roomname);
        }

    });
});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});