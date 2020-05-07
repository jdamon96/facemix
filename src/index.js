// Copyright Placeholder

import * as facemesh from '@tensorflow-models/facemesh';
import * as meshHandler from './meshHandler.js';
import * as userInterface from './interface.js';

import adapter from 'webrtc-adapter';
import * as tf from '@tensorflow/tfjs-core';
import {setWasmPath} from '@tensorflow/tfjs-backend-wasm';
import wasmPath from '../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm';
import {load} from "@tensorflow-models/facemesh";

/**********************************
            Global Variables
 **********************************/
let model; //trained facemesh model

let profiler = [];
let lastSendAllTimes = []
let isInChat = false;

// client role can be INITIATOR or not
//      INITIATOR creates rooms and initiates RTC Peer Connection (sends offer)
//      non-INITIATOR recieves room invitations and responds to RTCPeerConnection offer (sends answer)
let initiator = false;

let currentRoom = '';
let currentFacemesh;

let socket = io(); //initializing the socket.io handle

// initializing variables to hold user's audio and video media streams
let accessedCamera = false;
let audioStream;
let videoStream;

let remoteAudio;
let localVideo;

let chatMode = false; // true if currently in chat
let chatPartner = null; // if in a chat, this holds the current chat partner
let sessionPartners = []; //list of all partners that this client has chatted with during session

setWasmPath(wasmPath);
tf.setBackend('wasm').then(() => {main()});

/**********************************
        ChatInstance Object
 **********************************/

let ChatInstance = {
    peerConnection: null,
    searchingForChatPartner: false,
    connected: false,
    localICECandidates: [],
    facemeshBuffer: [],

    endCurrentChat: function(){
        //if there is a peerConnection
        if(ChatInstance.peerConnection != null){
            // close the current peerConnection
            ChatInstance.peerConnection.close();
            // remove reference to closed peerConnection
            ChatInstance.peerConnnection = null;
        }     
    },

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
        console.log("Time since last sendAll: ", Date.now()-lastSendAllTimes[lastSendAllTimes.length-1])
        let total = 0;
        lastSendAllTimes.push(Date.now())
        for (let i = 2; i < lastSendAllTimes.length; i++) {
            total += (lastSendAllTimes[i] - lastSendAllTimes[i-1])
        }
        console.log("Average time between sendAlls: ", total / (lastSendAllTimes.length-1))
        ChatInstance.dataChannel.send(currentFacemesh);
    },

    initiateDataChannel: function(channel){  
        console.log('Setting up data channel');
        ChatInstance.dataChannel = channel;

        ChatInstance.dataChannel.addEventListener('open', event => {
            isInChat = true
        });

        ChatInstance.dataChannel.addEventListener('message', event => {
            ChatInstance.searchingForChatPartner = false;
            userInterface.enableNewChatButton();
            let incomingMesh = event["data"].split(',')
            for (let i = 0; i < incomingMesh.length; i++) {
                incomingMesh[i] = parseFloat(incomingMesh[i])
            }
            meshHandler.updatePeerMesh(incomingMesh)
            //console.log("After parse: ")
            //console.log(incomingMesh)

            meshHandler.updatePeerMesh(incomingMesh);
        });

        ChatInstance.dataChannel.addEventListener('close', event => {
            console.log('Data channel closed');
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
            ChatInstance.peerConnection.addTrack(audioTrack);

            // send any ice candidates to the other peer
            ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;
            console.log('Assigning this client to be initiator: ' + initiator);
            if(initiator){
                // create the data channel
                console.log('Creating a data channel')
                let dataChannel = ChatInstance.peerConnection.createDataChannel('facemesh channel',
                    {
                        maxRetransmits: 0,
                        reliable: false,
                        ordered: false
                    });
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

    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        ChatInstance.peerConnection.addIceCandidate(rtcCandidate);
    },

    onTrackHandler: function(event){
        remoteAudio.srcObject = new MediaStream([event.track]);
    }
};

/**********************************
            Event Handlers
**********************************/

// Handler function for recieving 'message' events emitted by other sockets
function handleMessage(message){

    switch(message.title){

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

// Handler function for recieving 'roomInvitation' events emitted by other sockets
function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        console.log('Found chat partner');
        socket.emit('joinroom', roomInvitation.roomname);
    }
}

// Hanlder function for event that occurs when the video element has successfully loaded video data given to it
function handleLoadedVideoData(event){
    console.log('Processing video data');
    var video = event.target;
    callModelAndRenderLoop(video);
}

function handleRoomJoin(data){
    console.log(data);
}

// Button Handlers

// Handler function for clicking the 'Find-Chat' button
function handleFindChat(){
    ChatInstance.searchingForChatPartner = true;
    console.log('Finding chat');
    // switch to chat UI after recieving first data msg from peer client
    userInterface.switchToChatUI();
    // disable 'New Chat' button because not in a chat yet
    userInterface.disableNewChatButton();
    //display loading spinner
    userInterface.beginLoader();

    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('roomjoined', handleRoomJoin);
}

// Handler function for clicking the end chat button
function handleEndChat(){
    ChatInstance.endCurrentChat();
    console.log('Ending chat');
    userInterface.switchToLobbyUI();
    userInterface.endLoader();
};

// Handler function for clicking the camera button
function handleMediaAccess(){
    //display loading spinner for facemesh model loading
    userInterface.beginLoader();
    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Accessed audio and video media');
            accessedCamera = true;
            userInterface.enableFindChatButton();
            audioStream = new MediaStream(stream.getAudioTracks());
            videoStream = new MediaStream(stream.getVideoTracks());
            // this will fire the 'loadeddata' event on the localVideo object
            localVideo.srcObject = videoStream;
        })
        .catch(error => {
            console.log('Failed to access user media');
            console.log(error);
        });
}

/**********************************
         Driver Functions
 **********************************/

async function loadModel() {
    let beforeModel = Date.now()
    model = await facemesh.load({maxFaces: 1});
    console.log("Loaded in ", Date.now()-beforeModel);
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

function updateProfiler(profiler, checkpointIndex, checkpoints) {

    let checkpointName = checkpoints[checkpointIndex]
    let lastCheckpointName = checkpointIndex == 0 ? checkpoints[checkpoints.length-1] : checkpoints[checkpointIndex-1]
    if (checkpointName in profiler && lastCheckpointName in profiler) {
        let lastCheckpointTime = profiler[lastCheckpointName][0]
        let totalElapsed = profiler[checkpointName][1]
        profiler[checkpointName] = [Date.now(), totalElapsed + (Date.now() - lastCheckpointTime)]
    } else {
        profiler[checkpointName] = [Date.now(), 0]
    }

}

async function callModelAndRenderLoop(localVideo) {
    let profiler = [];
    let checkpoints = ["Timeout length: ", "Model Responded: ", "Handle Mesh: ", "Render: "];
    let iterator = 0;

    setInterval(async () => {
        iterator++;
        updateProfiler(profiler, 0, checkpoints);
        if (iterator == 100) {
            //console.log("After 100")
            for (let i = 0; i < checkpoints.length; i++) {
                //console.log(checkpoints[i], profiler[checkpoints[i]][1] / 100.0);
            }
            profiler = [];
            iterator = 0;
        }
        const rawFacemesh = await getScaledMesh(localVideo);
        updateProfiler(profiler, 1, checkpoints);

        meshHandler.updatePersonalMesh(rawFacemesh);
        currentFacemesh = meshHandler.getPersonalMeshForTransit();
        if (isInChat) {
            ChatInstance.sendFacemeshData();
        }
        updateProfiler(profiler, 2, checkpoints);
        meshHandler.render();

        // if searching for chat partner, don't kill the loader
        if(!ChatInstance.searchingForChatPartner){
            //has chat partner - kill the loader
            userInterface.endLoader();
        }
        updateProfiler(profiler, 3, checkpoints);
    }, 50);
}

function main() {
    loadModel();
    socket.on('message', handleMessage);// Add message event handler for client socket
    socket.on('offer', ChatInstance.onOffer); // Add an offer handler if this socket recieves an RTCPeerConnection offer from another client */

    /* Don't need to declare these variables because they're already declared in 'index.js' - just leaving here for readability */
    const faceScanButton = document.getElementById('camera-access');
    const findChatButton = document.getElementById('find-a-chat');
    const newChatButton = document.getElementById('new-chat');
    const endChatButton = document.getElementById('end-chat');

    /* Video HTML element to hold the media stream; this element is invisible on the page (w/ 'visibility' set to hidden) */
    localVideo = document.getElementById('localVideo');
    remoteAudio = document.getElementById('remoteAudio');
    localVideo.addEventListener('loadeddata', handleLoadedVideoData);


    /* Disable 'find chat' button if no access to client media feed
    * (can't join chat if you don't have your camera on) */
    if(localVideo.srcObject == null){
        userInterface.disableFindChatButton();
    }

    // Adding the 'click' event listener to the button and attaching the handler function
    findChatButton.addEventListener('click', handleFindChat);
    endChatButton.addEventListener('click', handleEndChat);
    faceScanButton.addEventListener('click', handleMediaAccess);
}