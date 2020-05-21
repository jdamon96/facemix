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
        console.log('Waitlist current state: ');
        console.log(waitlist);
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
            console.log('Joining the waitlist:');
            console.log(socket.id);
            waitlist.push(socket.id);
            
        }            
    });

    // join a specific room
    socket.on('joinroom', function(roomname){
    
        // Get list of clients in the specified room
        var clients = io.sockets.adapter.rooms[roomname];

        // get number of clients
        var numClients = typeof clients !=='undefined' ? clients.length: 0;

        // if there are no clients in the room
        if(numClients == 0){
            console.log('No one in room');
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
            console.log('SERVER: second client joining room');
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
            socket.emit('message', {
                title: 'room-full',
                content: socket.room
            });
            console.log('SERVER: room "' + socket.room + '" is full');
        } 
    });

    // Provide client with a Network Traversal Service Token from Twilio 
    // "Twilio’s Network Traversal Service is a globally distributed STUN/TURN service that helps you deploy more reliable peer-to-peer communications applications."
    socket.on('token', function(){
        twilio.tokens.create(function(err, response){
            if(err) {
                console.log(err);
                socket.emit('error', err)
            }
            else {
                console.log('SERVER: returning token to client');
                //send the token to the requesting client
                socket.emit('token', response);
            }
        });
    });

    // recieve 'candidate' from client and relay to the other client in the room
    socket.on('candidate', function(msg){    
        console.log('SERVER: sending candidate to client');
        socket.broadcast.to(msg.room).emit('candidate', msg.candidate);
    });

    socket.on('end-chat', function(){
        console.log('SERVER: one of the clients ended the chat. Removing all clients from room.');

        let roomname = socket.room;
        socket.broadcast.to(roomname).emit('chat-ended');
        clearRoom(roomname);
  
    });

    // recieve 'offer' from client and relay to the other client in the room
    socket.on('offer', function(msg){
        console.log('SERVER: sending offer to client');
        socket.broadcast.to(msg.room).emit('offer', msg.offer);
    });

    // recieve 'answer' from client and relay to the other client in the room
    socket.on('answer', function(msg){
        console.log('SERVER: sending answer to client');
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


        if(socket.room){
            let roomname = socket.room;
            socket.broadcast.to(roomname).emit('chat-ended');
            clearRoom(roomname);
        }

    });
});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});