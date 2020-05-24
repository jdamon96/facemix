// index.js
let express = require('express');
let app = express();
let http = require('http').createServer(app);
let io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;
const LOBBY_NAME = 'main-lobby';

let twilio = require('twilio')(
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
    let index = waitlist.indexOf(socketId);
    if (index > -1) {
        console.log('Removing ', socketId, ' from the waitlist');
        console.log('Waitlist before removal: ', waitlist);
        waitlist.splice(index, 1);
        console.log('Waitlist after removal: ', waitlist);
    }
}

io.on('connection', function(socket){

    serverPopulation = (serverPopulation + 1);

    io.sockets.emit('message', {
        title: 'population-update',
        content: {
            population: serverPopulation
        }
    });

    function getRoomName(client_id, chat_partner_id) { // Make unique room name
        let roomName = client_id + chat_partner_id;
        return(roomName);
    };

    function createRoomInvitation(client_id, chat_partner_id){
        const newRoomName = getRoomName(socket.id, chat_partner_id);

        const roominvitation = { // Create room invitation for the chat partner */
            recipient: chat_partner_id,
            roomname: newRoomName
        }
        return roominvitation;
    };

    // Find a chat partner
    socket.on('join', function(){
        console.log('Waitlist current state: ', waitlist);

        const firstInLine = waitlist.shift();// Remove the first person off the front of the line and store it
        if(firstInLine){ // If there was someone in line
            const roominvitation = createRoomInvitation(socket.id, firstInLine); // Invite the chat partner to a room

            console.log(socket.id, 'joined and waitlist was non-empty. Sending room invitation to:', firstInLine);
            io.to(firstInLine).emit('roominvitation', roominvitation);

            socket.room = roominvitation.roomname;
            socket.join(socket.room); // Put this client in the room

            socket.emit('message', { // Send message to this client telling it that it is the initiator
                title: 'initiator-status',
                content: {
                    initiator: true
                }
            });

            socket.emit('message', { // Send message to this client telling it that it has joined a room
                title: 'room-joined',
                content: {
                    roomname: roominvitation.roomname
                }
            });

        } else { // Waitlist is empty, join the line
            console.log('No one in waitlist to pair with, so adding ', socket.id, ' to the waitlist');
            waitlist.push(socket.id);
        }            
    });

    socket.on('joinroom', function(roomname){ // join a specific room
        console.log(socket.id + ' processing invitation to join room ' + roomname);

        let clients = io.sockets.adapter.rooms[roomname]; // Get list of clients in the specified room
        let numClients = typeof clients !=='undefined' ? clients.length: 0;  // get number of clients

        if(numClients == 0){  // No clients in the room
            console.log('No one in room, emitting room-joined event');
            socket.room = roomname;
            socket.emit('message', {
                title: 'room-joined',
                content: {
                    roomname: roomname
                }
            });
            socket.join(socket.room);
        } else if (numClients == 1) { // One other client in the room
            console.log('Second client joining room, emitting room-joined and room-ready events');
            socket.room = roomname;
            socket.join(socket.room);

            socket.emit('message', { //tell this client it joined a room
                title: 'room-joined',
                content: {
                    roomname: roomname
                }
            });

            socket.broadcast.to(roomname).emit("message", { // tell the other client in the room that the room is ready
                title: 'room-ready',
                content: {
                    room_population: 2
                }
            });
        }
        else { // 2 other clients in the room, tell this client the room is full
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
            } else {
                console.log('Returning Twilio token to ' + socket.id);
                socket.emit('token', response); //send the token to the requesting client
            }
        });
    });

    // receive 'candidate' from client and relay to the other client in the room
    socket.on('candidate', function(msg){
        socket.broadcast.to(msg.room).emit('candidate', msg.candidate);
    });

    socket.on('end-chat', function(){
        console.log(socket.id, 'ended the chat.');
        removeFromWaitlist(socket.id);
        if(socket.room != null){
            console.log(socket.id, 'was in room', socket.room, '. Broadcasting \'chat ended\' event to all clients in the room and clearing the room.');
            socket.broadcast.to(socket.room).emit('chat-ended');
            clearRoom(socket.room); 
        }
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
        serverPopulation = (serverPopulation - 1); // update population count on disconnect

        io.sockets.emit('message', {
            title: 'population-update',
            content: {
                population: serverPopulation
            }
        });

        removeFromWaitlist(socket.id);

        if(socket.room){
            console.log("One of the clients disconnected from the chat. Removing all clients from the room.")
            let roomname = socket.room;
            socket.broadcast.to(roomname).emit('chat-ended');
            clearRoom(roomname);
        }
    });
});


http.listen(PORT, function() {
  console.log(`listening on ${PORT}`);
});