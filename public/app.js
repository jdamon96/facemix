/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');
const meshHandler = require('./meshHandler.js')
/********************************/
/* Declare required global variables */
/********************************/
const decimalPrecision = 2 //Number of places to round decimals in model output to

/* true if currently in chat*/ 
var chatMode = false;
var profiler = []

/* true if in process of finding a chat partner*/
var waitingForChat = false;

// if in a chat, this holds the current chat partner
var chatPartner = null;

// client role can be INITIATOR or not
//      INITIATOR creates rooms and initiates RTC Peer Connection (sends offer)
//      non-INITIATOR recieves room invitations and responds to RTCPeerConnection offer (sends answer)
var initiator = false;

var currentRoom = '';
var currentFacemesh;

//list of all partners that this client has chatted with during session
var sessionPartners = [];

//initializing the socket.io handle
var socket = io();

// initializing variables to hold user's audio and video media streams
var audioStream;
var videoStream;

/**********************************/
/*        WebRTC Setup Code       */
/**********************************/

/*
* Note: this 'ChatInstance' object is responsible for setting up and managing the RTCPeerConnection
*/ 

var ChatInstance = {
    connected: false,
    localICECandidates: [],
    facemeshBuffer: [],

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
                    room: currentRoom,
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
                    room: currentRoom,
                    answer: JSON.stringify(answer)
                });
            },
            function(err){
                console.log(err);
            }
        );
    },

    sendFacemeshData: function(){
        var chunkSize = 16384;
        var bufferFullThreshold = 5 * chunkSize;

        if (typeof ChatInstance.dataChannel.bufferedAmountLowThreshold === 'number'){
            console.log('Using the bufferedamountlow event for flow control');
            usePolling = false;

            // Reduce the buffer fullness threshold, since we now have more efficient
            // buffer management.
            bufferFullThreshold = chunkSize / 2;

            // This is "overcontrol": our high and low thresholds are the same.
            ChatInstance.dataChannel.bufferedAmountLowThreshold = bufferFullThreshold;    
        }

        // Listen for one bufferedamountlow event.
        var listener = function() {
            ChatInstance.dataChannel.removeEventListener('bufferedamountlow', listener);
            sendAllData();
        };

        var sendAllData = function(){
            // Try to queue up a bunch of data and back off when the channel starts to
            // fill up. We don't setTimeout after each send since this lowers our
            // throughput quite a bit (setTimeout(fn, 0) can take hundreds of milli-
            // seconds to execute).
            while(true){
                // if exceeding buffer threshold
                if (ChatInstance.dataChannel.bufferedAmount > bufferFullThreshold) {
                    if (usePolling) {
                      setTimeout(sendAllData, 250);
                    } else {
                      ChatInstance.dataChannel.addEventListener('bufferedamountlow', listener);
                    }
                    return;
                }                
                ChatInstance.dataChannel.send(currentFacemesh);
            }
        };     
        
        setTimeout(sendAllData, 0);
    },

    initiateDataChannel: function(channel){  
        console.log('Setting up data channel');
        ChatInstance.dataChannel = channel;

        ChatInstance.dataChannel.addEventListener('open', event => {
            console.log('Channel opened');
            ChatInstance.sendFacemeshData();
        });

        ChatInstance.dataChannel.addEventListener('message', event => {
            let incomingMesh = event["data"].split(',')
            for (let i = 0; i < incomingMesh.length; i++) {
                incomingMesh[i] = parseFloat(incomingMesh[i])
            }
            console.log("After parse: ")
            console.log(incomingMesh)

            meshHandler.updateIncomingMesh(incomingMesh)
        });

        ChatInstance.dataChannel.addEventListener('close', (event) => {
            console.log('Channel closed');
            console.log(event);
        });
    },

    createPeerConnection: function(){
        socket.on('token', ChatInstance.onToken());
        socket.emit('token');
    },

    onToken: function(){
        console.log('firing onToken function');
        return function(token){
            // Create the peer connection
            ChatInstance.peerConnection = new RTCPeerConnection({
                iceServers: token.iceServers
            });

            // attach handler for when a new track is added to the peer connection
            ChatInstance.peerConnection.addEventListener('track', ChatInstance.onTrackHandler);

            // Add user's local audio track to the peer connection
            let audioTracks = audioStream.getAudioTracks();
            let audioTrack = audioTracks[0];
            console.log(audioTracks);
            console.log(audioTrack);
            ChatInstance.peerConnection.addTrack(audioTrack);

            // send any ice candidates to the other peer
            ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;
            console.log('Assigning this client to be initiator: ' + initiator);
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
                room: currentRoom,
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
                    room: currentRoom,
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

    // handle new track being added to the rtcPeerConnection
    onTrackHandler: function(event){
        console.log(event);
        remoteAudio.src = URL.createObjectURL(event.streams[0]);
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
    const faces = await model.estimateFaces(video);
    if(faces[0]){
        return faces[0].scaledMesh;    
    }
    else {
        console.log('Program does not detect a face');
    }
    
}

function flattenAndTruncateMesh(rawFacemesh) {
    let flattenedMesh = []
    const roundConstant = 10 ** decimalPrecision
    for (let i = 0; i < rawFacemesh.length; i++) {
        for (let j = 0; j < 3; j++) {
            flattenedMesh.push(Math.round(rawFacemesh[i][j] * roundConstant) / roundConstant)
        }
    }
    return flattenedMesh
}

async function logScaledMesh(localVideo) {
    setInterval(async () => {
        profiler.push(["Timeout over", Date.now()])
        for (let i = 0; i < profiler.length; i++) {
            let diff = 0
            if (i != 0) {
                diff = profiler[i][1] - profiler[i-1][1]
            }
            //console.log(profiler[i][0], diff)
        }
        profiler = []
        profiler.push(["Time 0: ", Date.now()])
        const rawFacemesh = await getScaledMesh(localVideo);
        profiler.push(["Model Responded: ", Date.now()])
        currentFacemesh = flattenAndTruncateMesh(rawFacemesh);
        profiler.push(["Formatted Mesh: ", Date.now()])
        meshHandler.updateOutgoingMesh(currentFacemesh);
        profiler.push(["Updated Outgoing Mesh: ", Date.now()])
        meshHandler.render(profiler);
        profiler.push(["Render finished: ", Date.now()])
    }, 50);
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
            currentRoom = message.content.roomname;
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
const localVideo = document.getElementById('localVideo');
// ho
const remoteAudio = document.getElementById('remoteAudio');


/*
* Event handler for event that occurs when the video element has successfully loaded video data given to it
*/ 
function handleLoadedVideoData(event){
    console.log('Processing video data');
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
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Accessed audio and video media');
            audioStream = new MediaStream(stream.getAudioTracks());
            videoStream = new MediaStream(stream.getVideoTracks());
            localVideo.srcObject = videoStream;        
        })
        .catch(error => {
            console.log('Failed to access user media');
            console.log(error);
        });

    // enable the find chat button
    findChatButton.disabled = false;

}

faceScanButton.addEventListener('click', handleMediaAccess);