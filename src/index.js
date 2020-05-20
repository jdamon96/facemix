// Copyright Placeholder

import * as facemesh from '@tensorflow-models/facemesh';
import * as meshHandler from './meshHandler.js';
import * as userInterface from './interface.js';
import {ChatInstance} from './chatInstance.js';

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

// initializing variables to hold user's audio and video media streams
let accessedCamera = false;
let videoStream;

let remoteAudio = document.getElementById('remoteAudio');
let localVideo;
let hasSentColor = false;

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
            ChatInstance.setInitiator(message.content.initiator);
            break;

        case 'text-message':
            console.log('New text message:');
            console.log(message.content)
            break;

        case 'room-joined':
            ChatInstance.setRoom(message.content.roomname);
            if(!ChatInstance.initiator){
                ChatInstance.createPeerConnection();
            }
            break;

        case 'room-ready':
            console.log('Room is ready for initiating RTCPeerConnection between clients');
            if(ChatInstance.initiator){
                ChatInstance.createPeerConnection();
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

function playConnectedTone(){
    let connectedTone = document.getElementById('connected-tone');
    connectedTone.volume = 0.5;
    connectedTone.play();
}

// Handler function for event that occurs when the video element has successfully loaded video data given to it
function handleLoadedVideoData(event){
    console.log('Processing video data');
    var video = event.target;
    callModelRenderLoop(video);
    playConnectedTone();
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
    ChatInstance.endCurrentChat();
    console.log('Ending chat');
    userInterface.switchToLobbyUI();
    userInterface.endLoader();
    meshHandler.clearPeerMesh();
    meshHandler.render();
};

// Handler for a new color selection
function handleColorChange(){
    let color = document.getElementById('color-picker').value;
    if (ChatInstance.shouldSendFacemeshData) {
        ChatInstance.sendFacemeshData("color," + color);
    }
    meshHandler.setPersonalColor(color);
}

// Handler function for clicking the 'Face-scan' button
function handleMediaAccess(){
    // disable the face-scan button to prevent double-firing
    userInterface.disableFaceScanButton();

    //display loading spinner for facemesh model loading
    userInterface.beginLoader();

    localVideo = document.getElementById('localVideo');

    // get access to client media streams
    const stream = navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Accessed audio and video media');
            localVideo.addEventListener('loadeddata', handleLoadedVideoData);
            accessedCamera = true;
            userInterface.enableFindChatButton();
            ChatInstance.setAudioStream(new MediaStream(stream.getAudioTracks()));
            videoStream = new MediaStream(stream.getVideoTracks());
            console.log(localVideo);
            localVideo.srcObject = videoStream; // this will fire the 'loadeddata' event on the localVideo object
            localVideo.play();
            userInterface.removeFaceScanButton();
            userInterface.showColorPickerButton();
        })
        .catch(error => {
            userInterface.endLoader();
            userInterface.showNoCameraAccessMessage();
            userInterface.enableFaceScanButton();
            console.log('Failed to access user media');
            console.log(error);
        });
}

/* Handler function for when chat peer ends the current chat*/
function handlePeerEndChat(){
    console.log('Peer client ended chat');
    ChatInstance.resetChatInstance();
    meshHandler.clearPeerMesh();
    meshHandler.render();
    handleFindChat();
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

function logCanvasDimensions(){
    let canvasContainer = document.getElementById('canvas-container');
    let canvas = document.getElementById('canvas');
    console.log('Canvas Container width:');
    console.log(canvasContainer.clientWidth)
    console.log('Canvas Container height:');
    console.log(canvasContainer.clientHeight);
    console.log('Canvas width:');
    console.log(canvas.width);
    console.log('Canvas height:');
    console.log(canvas.height);   
}

async function callModelRenderLoop(){

    updateProfiler(0);
    let predictions = await model.estimateFaces(localVideo);
    updateProfiler(1);

    let facemesh;

    if (predictions.length > 0){
        facemesh = predictions[0].scaledMesh;
        meshHandler.updatePersonalMesh(facemesh);
        updateProfiler(2);

        if(ChatInstance.shouldSendFacemeshData){
            ChatInstance.sendFacemeshData(meshHandler.getPersonalMeshForTransit());
            if (!hasSentColor) {
                handleColorChange()
                hasSentColor = true;
            }
        }

        userInterface.endLoader();
        meshHandler.resizeCanvas();
        meshHandler.render();
        updateProfiler(3);
    }
    renderIterator++;
    if (renderIterator % 100 == 0) { 
        logProfiler();
        logCanvasDimensions();
    }

    requestAnimationFrame(callModelRenderLoop);
}

function main() {
    /* give ChatInstance access to the client socket*/
    ChatInstance.setSocket(socket);

    /* add initial socket event handlers */
    socket.on('message', handleMessage);
    socket.on('offer', ChatInstance.onOffer);
    socket.on('end-chat', handlePeerEndChat);

    /* Don't need to declare these variables because they're already declared in 'index.js' - just leaving here for readability */
    const faceScanButton = document.getElementById('camera-access');
    const findChatButton = document.getElementById('find-a-chat');
    const endChatButton = document.getElementById('end-chat');
    const colorPicker = document.getElementById('color-picker');

    /* Disable 'find chat' button if no access to client media feed
    * (can't join chat if you don't have your camera on) */
    if(localVideo == null){
        userInterface.disableFindChatButton();
    }

    // Adding the 'click' event listener to the button and attaching the handler function
    findChatButton.addEventListener('click', handleFindChat);
    endChatButton.addEventListener('click', handleEndChat);
    faceScanButton.addEventListener('click', handleMediaAccess);
    colorPicker.addEventListener('change', handleColorChange);

    /* set init facemesh color to init color picker value*/
    let color = colorPicker.value;
    meshHandler.setPersonalColor(color);

    /* load the tensorflow facemesh model */
    loadModel();
}


