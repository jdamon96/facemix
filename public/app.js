/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');
const ChatSession = require('./js/ChatSession.js');

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


/********************************/
/* Initial code run upon website load */
/********************************/

var model = facemesh.load();
socket.on('message', handleMessage);


/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');

/* disable 'find chat' button if no access to client media feed */
if(localMediaStream == null){
    findChatButton.disabled = true;
}

function handleFindChat(){
    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
}

findChatButton.addEventListener(
    'click',
    handleFindChat
)

var cameraToggleButton = document.getElementById('camera-toggle');

/*
must be either an:
- HTMLVideoElement 
- HTMLImageElement
- HTMLCanvasElement
- ImageData in browser
- OffscreenCanvas
- ImageData in webworker
- {data: Uint32Array, width: number, height: number}

Can't be MediaStream
*/


/* 
* Look a Web Worker to convert MediaStream to ImageData 
* which is then passed to model.estimateFaces
*/

function handleCameraToggle(){

    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Media stream acquired');
            localMediaStream = stream;
            console.log(localMediaStream);

            setInterval(function(){
                model.estimateFaces(localMediaStream).then(faces => {
                    console.log(faces[0].scaledMesh);
                });
            }, 100);

             
        })
        .catch(error => {
            console.log('No media stream');
            console.log(error);
        });

    // enable the find chat button
    findChatButton.disabled = false;

}

cameraToggleButton.addEventListener(
    'click',
    handleCameraToggle
)

