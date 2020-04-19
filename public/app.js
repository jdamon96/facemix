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

// client role can be HOST or GUEST. 
//      HOST creates rooms and initiates RTC Peer Connection (sends offer)
//      GUEST recieves room invitations and responds to RTCPeerConnection offer (sends answer)
var initiator = false;

var current_room = '';

var current_facemesh = null;

//list of all partners that this client has chatted with during session
var sessionPartners = [];

//initializing the socket.io handle
var socket = io();

/**********************************/
/*        WebRTC Setup Code       */
/**********************************/

/*
* Note: this 'ChatInstance' object is responsible for setting up and managing the RTCPeerConnection
*/ 

var ChatInstance = {
    connected: false,
    localICECandidates: [],

    onOffer: function(offer){
        console.log('Recieved offer. Sending answer to peer.');
        ChatInstance.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
        ChatInstance.createAnswer();
    },

    createOffer: function(){
        ChatInstance.peerConnection.createOffer(
            function(offer){
                ChatInstance.peerConnection.setLocalDescription(offer);
                socket.emit('offer', {
                    room: current_room,
                    offer: JSON.stringify(offer)
                });
            },
            function(err){
                console.log(err);
            }
        );
    },

    createAnswer: function(){  
        ChatInstance.connected = true;  
        ChatInstance.peerConnection.createAnswer(
            function(answer){
                ChatInstance.peerConnection.setLocalDescription(answer);
                socket.emit('answer', {
                    room: current_room, 
                    answer: JSON.stringify(answer)
                });
            },
            function(err){
                console.log(err);
            }
        );
    },

    initiateDataChannel: function(channel){  
        console.log('Initiating data channel');
        ChatInstance.dataChannel = channel;
        console.log(ChatInstance.dataChannel);

        ChatInstance.dataChannel.addEventListener('open', event => {
            console.log('Channel opened');
            setInterval(function(){
                ChatInstance.dataChannel.send(current_facemesh);
            }, 10);           
        });

        ChatInstance.dataChannel.addEventListener('message', event => {
            console.log(event);
        });

        ChatInstance.dataChannel.addEventListener('close', (event) => {
            console.log('Channel closed');
        });
    },

    createPeerConnection: function(){
        socket.on('token', ChatInstance.onToken());
        socket.emit('token');
    },

    onToken: function(){
        console.log('firing onToken function');
        return function(token){
            //Create the peer connection
            ChatInstance.peerConnection = new RTCPeerConnection({
                iceServers: token.iceServers
            });

            // send any ice candidates to the other peer
            ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;
            console.log('Initiator: ' + initiator);
            if(initiator){
                // create the data channel
                console.log('Creating a data channel')
                let dataChannel = ChatInstance.peerConnection.createDataChannel('facemesh channel', {maxRetransmits: 0, ordered: false});
                ChatInstance.initiateDataChannel(dataChannel);     

                //create an offer
                console.log('Creating an offer')
                ChatInstance.createOffer();
            } else {
                ChatInstance.peerConnection.addEventListener('datachannel', event => {
                    console.log('datachannel:', event.channel);
                    ChatInstance.initiateDataChannel(event.channel);
                });
            }

            socket.on('candidate', ChatInstance.onCandidate);
            socket.on('answer', ChatInstance.onAnswer);
        }
    },


    /*
    * Handler function for recieving an ANSWER 
    * - Sets remote client session description of RTCPeerConnection 
    * - Update 'connected' to true
    * - Send ICECandidates to remote client from localICeCandidate buffer
    * - clear localIceCandidate buffer
    */ 
    onAnswer: function(answer){
        ChatInstance.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));

        ChatInstance.connected = true;
        
        // Take buffer of localICECandidates we've been saving and emit them now that connected to remote client
        ChatInstance.localICECandidates.forEach(candidate => {
            socket.emit('candidate', {
                room: current_room, 
                candidate: JSON.stringify(candidate)
            });
        });
        
        //Clear the buffer now that we've offloaded the candidates to the remote client
        ChatInstance.localICECandidates = [];
    },


    onIceCandidate: function(event){
        if(event.candidate){
            if(ChatInstance.connected){
                console.log('Generated candidate');  
                socket.emit('candidate', {
                    room: current_room,
                    candidate: JSON.stringify(event.candidate)
                });
            } else {
                ChatInstance.localICECandidates.push(event.candidate)
            }
        }
    },

    /*
    * Handle recieving ICECandidates from the other client
    *   - create new IceCandidate from data sent
    *   - add IceCandidate to our Chat Instance's RTCPeerConnection
    */
    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        ChatInstance.peerConnection.addIceCandidate(rtcCandidate);
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){  

    }
};

/********************************/
/******* Facemesh set-up ********/
/********************************/

/*
* initializing variable that will hold the facemesh model
*/
var model;

/*
* Defining required functions for handling facemodel
*/
async function loadModelInternal() {
    model = await facemesh.load();
}

async function getScaledMesh(localVideo) {
    const video = localVideo;
    //console.log('estimating faces...');
    const faces = await model.estimateFaces(video);
    //console.log('done estimating faces');
    if(faces[0]){
        return faces[0].scaledMesh;    
    }
    else {
        console.log('Program does not detect a face');
    }
    
}

async function logScaledMesh(localVideo) {
    setInterval(async () => {
        current_facemesh = await getScaledMesh(localVideo);
        //console.log('Local facemesh data:')
        //console.log(scaledMesh);
        
        /*await drawObjects(scaledMesh, canvases[canvasNames.clientCanvas].gl);*/
    }, 100);
}


/*
* Load the facemesh model
*/
loadModelInternal();

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

        case 'initiator-status':
            initiator = message.content.initiator;
            break;

        case 'text-message':
            console.log('New text message:');
            console.log(message.content)
            break;

        case 'room-joined':
            current_room = message.content.roomname;
            if(!initiator){
                ChatInstance.createPeerConnection();    
            }
            break;

        case 'room-ready':
            console.log('Room is ready for initiating RTCPeerConnection between clients');
            if(initiator){
                ChatInstance.createPeerConnection();
            }
            break;
    }
}

/*
* Handler function for recieving 'roomInvitation' events emitted by other sockets
*/
function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        console.log('Found chat partner');
        socket.emit('joinroom', roomInvitation.roomname);
    }
}

/********************************/
/* Add initial event listeners required for the socket*/
/********************************/

/* Add message event handler for client socket*/
socket.on('message', handleMessage);

/* Add an offer handler if this socket recieves an RTCPeerConnection offer from another client */
socket.on('offer', ChatInstance.onOffer);

/**********************************/
/* Button handlers and event listeners */
/**********************************/

/* Don't need to declare these variables because they're already declared in 'index.js' - just leaving here for readability */
const faceScanButton = document.getElementById('camera-access');
const findChatButton = document.getElementById('find-a-chat');

/* Video HTML element to hold the media stream; this element is invisible on the page (w/ 'visibility' set to hidden) */
const localVideo = document.getElementById('videoElement');


/*
* Event handler for event that occurs when the video element has successfully loaded video data given to it
*/ 
function handleLoadedVideoData(event){
    console.log('video data loaded');
    
    var video = event.target;
    logScaledMesh(video);
}

/*
* Adding the event listner and attaching the handler function
*/
localVideo.addEventListener('loadeddata', handleLoadedVideoData);

/* disable 'find chat' button if no access to client media feed 
* ( can't join chat if you don't have your camera on )*/
if(localVideo.srcObject == null){
    findChatButton.disabled = true;
}


function handleRoomJoin(data){
    console.log(data);
}


/*
* Handler function for clicking the 'Find-Chat' button
*/
function handleFindChat(){
    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('roomjoined', handleRoomJoin);
}

/*
* Adding the 'click' event listener to the button and attaching the handler function
*/

findChatButton.addEventListener('click', handleFindChat);

/*
* Handler function for the camera button
*/
function handleMediaAccess(){

    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: false})
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

faceScanButton.addEventListener('click', handleMediaAccess);