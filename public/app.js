/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');
const ChatSession = require('./js/ChatSession.js')

/********************************/
/* Declare required global variables */
/********************************/

/* true if currently in chat*/ 
var chatMode = false;

/* true if in process of finding a chat partner*/
var waitingForChat = false;

// if in a chat, this holds the current chat partner
var chatPartner = null;

//list of all partners that this client has chatted with during session
var sessionPartners = [];

var localMediaStream = null;

var peerMediaStream = null;

var socket = io();

/********************************/
/* Define required functions */
/********************************/

function handleMessage(message){

    switch(message.title){
        case 'waiting':
            waitingForChat = message.content;
            console.log('Waiting for chat partner: ' + waitingForChat);
            break;
        case 'room_count':
            console.log('room count: ' + message.contents)
    }
}

function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        console.log('Found chat partner');
        socket.emit('join', roomInvitation.room_name);
    }
}

function findChatHandler(){
    socket.emit('join');

    socket.on('roominvitation', handleRoomInvitation);
}

/********************************/
/* Initial code run upon website load */
/********************************/

socket.on('message', handleMessage);

/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');

findChatButton.addEventListener(
    'click',
    findChatHandler()
)

