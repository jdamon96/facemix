/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');

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

async function loadModel(){
    return await facemesh.load();
}

/********************************/
/* Initial code run upon website load */
/********************************/

const model = async () => {
    await loadModel();
}
console.log(model);

socket.on('message', handleMessage);



/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');

var localVideo = document.getElementById('videoElement');

/* disable 'find chat' button if no access to client media feed */
if(localVideo.localStream == null){
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

async function getFaces(){
    const faces = await model.estimateFaces(localVideo);
    return faces;
}

function handleCameraToggle(){

    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Media stream acquired');
            localVideo.localStream = stream;


             
        })
        .catch(error => {
            console.log('No media stream');
            console.log(error);
        });

    // get faces
    const faces = getFaces();
    // enable the find chat button
    findChatButton.disabled = false;

}

cameraToggleButton.addEventListener(
    'click',
    handleCameraToggle
)

