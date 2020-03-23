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
    console.log(message.title);
    console.log(message.content);
}

function findChatHandler(){
    socket.emit('join', 'test');

    socket.on('message', handleMessage);
}

/********************************/
/* Initial code run upon website load */
/********************************/



/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');

findChatButton.addEventListener(
    'click',
    findChatHandler()
)

