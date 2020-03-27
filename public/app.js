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

//initializing variable that will hold the facemesh model
var model;

//initializing the socket.io handle
var socket = io();

/********************************/
/* Define required functions */
/********************************/


/*
* Handler function for recieving 'message' events emitted by other sockets
*/
function handleMessage(message){

    switch(message.title){

        /** if the message title is 'waiting'... **/
        case 'waiting':
            //set waitingForChat variable to the message's content
            waitingForChat = message.content;
            console.log('Waiting for chat partner: ' + waitingForChat);
            break;

        /** if the message title is 'room_count'... **/
        case 'room_count':
            console.log('room count: ' + message.contents);
            break;
    }
}

/*
* Handler function for recieving 'roomInvitation' events emitted by other sockets
*/
function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        console.log('Found chat partner');
        socket.emit('join', roomInvitation.room_name);
    }
}

/********************************/
/* Facemesh model related functions*/
/********************************/
async function loadModelInternal() {
    model = await facemesh.load();
}

async function getScaledMesh(localVideo) {
    const video = localVideo;
    //console.log('estimating faces...');
    const faces = await model.estimateFaces(video);
    //console.log('done estimating faces');
    return faces[0].scaledMesh;
}
async function logScaledMesh(localVideo) {
    setInterval(async () => {
        var scaledMesh = await getScaledMesh(localVideo);
        //console.log(scaledMesh);
        /*await drawObjects(scaledMesh, canvases[canvasNames.clientCanvas].gl);*/
    }, 100);
}



/********************************/
/* Initial code run upon website load */
/********************************/

/* Add message event handler for client socket*/
socket.on('message', handleMessage);

/* Load facemesh model */
loadModelInternal();



/**********************************/
/*        WebRTC Setup Code       */
/**********************************/

/*
* This 'ChatInstance' object is responsible for setting up and managing the RTCPeer Connections
*/ 

/*
var ChatInstance = {
    connected: false,
    localICECandidates: [],

    onOffer: function(offer){
        ChatInstance.socket.on('token', ChatInstance.onToken(ChatInstance.createAnswer(offer)));
        ChatInstance.socket.emit('token');
    },

    createOffer: function(){
        ChatInstance.peerConnection.createOffer(
            function(offer){
                ChatInstance.peerConnection.setLocalDescription(offer);
                ChatInstance.socket.emit('offer', JSON.stringify(offer));
            },
            function(err){
                console.log(err);
            }
        );
    },

    createAnswer: function(offer){
        return function(){
            ChatInstance.connected = true;
            rtcOffer = new RTCSessionDescription(JSON.parse(offer));
            ChatInstance.peerConnection.setRemoteDescription(rtcOffer);
            ChatInstance.peerConnection.createAnswer(
                function(answer){
                    ChatInstance.peerConnection.setLocalDescription(answer);
                    ChatInstance.socket.emit('answer', JSON.stringify(answer));
                },
                function(err){
                    console.log(err);
                }
            );
        }
    },

    onToken: function(callback){
        return function(token){
            ChatInstance.peerConnection = new RTCPeerConnection({
                iceServers: token.iceServers
            });

            ChatInstance.peerConnection.addStream(ChatInstance.localStream);
            ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;
            ChatInstance.peerConnection.onaddstream = ChatInstance.onAddStream;
            // We set up the socket listener for the 'candidate' event within this onToken function because this is when we create the peerConnection and will be ready to deal with candidates
            ChatInstance.socket.on('candidate', ChatInstance.onCandidate);
            ChatInstance.socket.on('answer', ChatInstance.onAnswer);
            callback();
        }
    },

    onAddStream: function(event){
        ChatInstance.remoteVideo = document.getElementById('remote-video');
        ChatInstance.remoteVideo.srcObject = event.stream;
    },

    onAnswer: function(answer){
        var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
        ChatInstance.peerConnection.setRemoteDescription(rtcAnswer);
        // Set connected to true
        ChatInstance.connected = true;
        // Take buffer of localICECandidates and emit now that connected
        ChatInstance.localICECandidates.forEach(candidate => {
            ChatInstance.socket.emit('candidate', JSON.stringify(candidate));
        });
        // Re-initialize buffer to empty
        ChatInstance.localICECandidates = [];
    },

    
    // Here we check if the ChatInstance is connected before sending the candidate to the server.
    // If the ChatInstance is not connected, then we add them to a local buffer (the array localICECandidates)
    
    onIceCandidate: function(event){
        if(event.candidate){
            if(ChatInstance.connected){
                console.log('Generated candidate');  
                ChatInstance.socket.emit('candidate', JSON.stringify(event.candidate));
            } else {
                ChatInstance.localICECandidates.push(event.candidate)
            }
        }
    },

    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        ChatInstance.peerConnection.addIceCandidate(rtcCandidate);
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){
        ChatInstance.socket.on('token', ChatInstance.onToken(ChatInstance.createOffer));
        ChatInstance.socket.emit('token');
    }

};
*/

/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');
var cameraToggleButton = document.getElementById('camera-toggle');

var localVideo = document.getElementById('videoElement');


/*
* Event handler for event that occurs when the video element has successfully loaded video data given to it
*/ 
function handleLoadedVideoData(event){
    console.log('video data loaded');
    
    //var video = event.target;
    //logScaledMesh(video);
}

/*
* Adding the event listner and attaching the handler function
*/
localVideo.addEventListener(
    'loadeddata',
    handleLoadedVideoData
)

/* disable 'find chat' button if no access to client media feed 
* ( can't join chat if you don't have your camera on )*/
if(localVideo.srcObject == null){
    findChatButton.disabled = true;
}

function handleRoomJoin(){
    ChatInstance.
}

/*
* Handler function for clicking the 'Find-Chat' button
*/
function handleFindChat(){
    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('roomjoined', handleRoomJoin)
}

/*
* Adding the 'click' event listener to the button and attaching the handler function
*/

findChatButton.addEventListener(
    'click',
    handleFindChat
);

/*
* Handler function for the camera button
*/
function handleCameraToggle(){

    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Media stream acquired');
            localVideo.srcObject = stream;        
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
);