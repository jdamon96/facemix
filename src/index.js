// Copyright Placeholder

import * as facemesh from '@tensorflow-models/facemesh';
import * as meshHandler from './meshHandler.js';
import * as userInterface from './interface.js';
import * as ChatInstance from './chatInstance.js';

import * as tf from '@tensorflow/tfjs-core';
import {setWasmPath} from '@tensorflow/tfjs-backend-wasm';
import wasmPath from '../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm';

/**********************************
            Global Variables
 **********************************/
let model; //trained facemesh model

let profiler = [];
let checkpoints = ["Timeout length: ", "Model Responded: ", "Handle Mesh: ", "Render: "];
let renderIterator = 0;
let chatInstance = ChatInstance.ChatInstance

// initializing variables to hold user's audio and video media streams
let accessedCamera = false;
let videoStream;

let remoteAudio;
let localVideo;

let socket = io(); //initializing the socket.io handle

setWasmPath(wasmPath);
tf.setBackend('wasm').then(() => {main()});

/**********************************
            Event Handlers
**********************************/

// Handler function for receiving 'message' events emitted by other sockets
function handleMessage(message){

    switch(message.title){

        case 'initiator-status':
            chatInstance.setInitiator(message.content.initiator);
            break;

        case 'text-message':
            console.log('New text message:');
            console.log(message.content)
            break;

        case 'room-joined':
            chatInstance.setRoom(message.content.roomname);
            if(!chatInstance.initiator){
                chatInstance.createPeerConnection();
            }
            break;

        case 'room-ready':
            console.log('Room is ready for initiating RTCPeerConnection between clients');
            if(chatInstance.initiator){
                chatInstance.createPeerConnection();
            }
            break;
    }
}

// Handler function for receiving 'roomInvitation' events emitted by other sockets
function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        console.log('Found chat partner');
        socket.emit('joinroom', roomInvitation.roomname);
    }
}

// Handler function for event that occurs when the video element has successfully loaded video data given to it
function handleLoadedVideoData(event){
    console.log('Processing video data');
    var video = event.target;
    callModelRenderLoop(video);
}

function handleRoomJoin(data){
    console.log(data);
}

// Button Handlers

// Handler function for clicking the 'Find-Chat' button
function handleFindChat(){

    console.log('Finding chat');
    // switch to chat UI after receiving first data msg from peer client
    userInterface.switchToChatUI();
    // disable 'New Chat' button because not in a chat yet
    userInterface.disableNewChatButton();
    //display loading spinner
    userInterface.beginLoader();

    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('roomjoined', handleRoomJoin);
}

// Handler function for clicking the 'End-Chat' button
function handleEndChat(){
    chatInstance.endCurrentChat();
    console.log('Ending chat');
    userInterface.switchToLobbyUI();
    userInterface.endLoader();
};

// Handler function for clicking the 'Face-scan' button
function handleMediaAccess(){
    // disable the face-scan button to prevent double-firing
    userInterface.disableFaceScanButton();
    //display loading spinner for facemesh model loading
    userInterface.beginLoader();
    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Accessed audio and video media');
            accessedCamera = true;
            userInterface.enableFindChatButton();
            chatInstance.setAudioStream(new MediaStream(stream.getAudioTracks()));
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

function updateProfiler(checkpointIndex) {
    let checkpoints = ["Timeout length: ", "Model Responded: ", "Handle Mesh: ", "Render: "];
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

function logProfiler() {
    for (let i = 0; i < checkpoints.length; i++) {
        console.log(checkpoints[i], profiler[checkpoints[i]][1] / 100.0);
    }
    profiler = [];
    renderIterator = 0;
}

async function callModelRenderLoop(){
    updateProfiler(0);
    let predictions = await model.estimateFaces(localVideo);
    updateProfiler(1);
    userInterface.endLoader();

    if (predictions.length > 0) {
        let facemesh = predictions[0].scaledMesh;
        meshHandler.updatePersonalMesh(facemesh);
        updateProfiler(2);
        if(chatInstance.shouldSendFacemeshData){
            chatInstance.sendFacemeshData(meshHandler.getPersonalMeshForTransit());
        }
        meshHandler.render();
        updateProfiler(3);
    }
    renderIterator++;
    if (renderIterator % 100 == 0) { logProfiler() }

    requestAnimationFrame(callModelRenderLoop);
}

function main() {
    loadModel();
    chatInstance.setSocket(socket);
    socket.on('message', handleMessage);// Add message event handler for client socket
    socket.on('offer', chatInstance.onOffer); // Add an offer handler if this socket recieves an RTCPeerConnection offer from another client */

    /* Don't need to declare these variables because they're already declared in 'index.js' - just leaving here for readability */
    const faceScanButton = document.getElementById('camera-access');
    const findChatButton = document.getElementById('find-a-chat');
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