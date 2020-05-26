// Copyright Placeholder

import * as facemesh from '@tensorflow-models/facemesh';
import * as meshHandler from './meshHandler.js';
import * as userInterface from './interface.js';
import {ChatInstance} from './chatInstance.js';

import * as tf from '@tensorflow/tfjs-core';
import {setWasmPath} from '@tensorflow/tfjs-backend-wasm';
import wasmPath from '../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm';

/**********************************
    Global Variables & Init Code
 **********************************/
let model; //trained facemesh model

let profiler = [];
let checkpoints = ["Timeout length: ", "Model Responded: ", "Handle Mesh: ", "Render: "];
let renderIterator = 0;

let videoTrack;
let remoteAudio = document.getElementById('remoteAudio');
let localVideo = document.getElementById('localVideo');
let hasSentColor = false;

let socket = io(); //initializing the socket.io handle

setWasmPath(wasmPath);
tf.setBackend('wasm').then(() => {main()});

/**********************************
        Helper Functions
**********************************/

function updatePopulationCounter(population){
    let populationCounter = document.getElementById('population-counter');
    populationCounter.innerHTML = 'Number of people online: ' + population;
}

// Handler function for receiving 'roomInvitation' events emitted by other sockets
function handleRoomInvitation(roomInvitation){
    console.log("received room invitation")
    if(socket.id === roomInvitation.recipient){
        console.log(socket.id, 'received room invitation: ', roomInvitation);
        socket.emit('joinroom', roomInvitation.roomname);
    }
}

function playConnectedTone(){
    let connectedTone = document.getElementById('connected-tone');
    connectedTone.volume = 0.5;
    connectedTone.play();
}

function prepLocalVideo(videoStream){
    localVideo.addEventListener('loadeddata', handleLoadedVideoData);  
    localVideo.srcObject = videoStream; // this will fire the 'loadeddata' event on the localVideo object
    localVideo.play(); 
}

function updateUIForMediaAccess(){
    userInterface.enableFindChatButton();
    userInterface.enableFaceScanButton();
    userInterface.showColorPickerButton();
}

/**********************************
            Handlers
**********************************/

// Handler function for receiving 'message' events
function handleMessage(message){

    switch(message.title){

        case 'text-message':
            console.log('New text message:');
            console.log(message.content)
            break;

        case 'initiator-status':
            console.log('Setting initiator status of', socket.id, ':', message.content.initiator);
            ChatInstance.setInitiator(message.content.initiator);
            break;

        // triggers 'initiating' client to make their peer connection
            // in createPeerConnection(), initiator creates the data channel and offers
        case 'room-ready':
            console.log('Room is ready for initiating RTCPeerConnection between clients');
            if(ChatInstance.initiator){
                console.log('Firing create peer connection');
                ChatInstance.createPeerConnection();
            }
            break;

        // triggers 'non-initiating' client to make their peer connection
            // in createPeerConnection(), non-initiator listens for data channel
            // creation and doesn't create offers (waits to receive offer and create answer)
        case 'room-joined':
            ChatInstance.setRoom(message.content.roomname);
            if(!ChatInstance.initiator){
                console.log('Firing create peer connection');
                ChatInstance.createPeerConnection();
            }
            break;

        case 'population-update':
            let serverPopulation = message.content.population;
            updatePopulationCounter(serverPopulation);
            break;
    }
}

// Handler function for event that occurs when the video element has successfully loaded video data given to it
function handleLoadedVideoData(event){
    console.log('Processing video data');
    let video = event.target;
    callModelRenderLoop(video);
    playConnectedTone();
}

// Handler function for clicking the 'Find-Chat' button
function handleFindChat(){
    console.log('Finding new chat partner');
    // switch to chat UI after receiving first data msg from peer client
    userInterface.switchToChatUI();
    // disable 'New Chat' button because not in a chat yet
    userInterface.disableNewChatButton();
    //display loading spinner
    userInterface.beginLoader();

    socket.emit('join');
}

// Handler function for clicking the 'End-Chat' button
function handleEndChat(){
    console.log('Ending chat');
    ChatInstance.endCurrentChat(); // emits 'end-chat' event to server
    userInterface.switchToLobbyUI();
    userInterface.endLoader();
    meshHandler.clearPeerMesh();
    meshHandler.render();
};

// Handler function for clicking the 'New-Chat' button
function handleNewChat(){
    ChatInstance.endCurrentChat();
    meshHandler.clearPeerMesh();
    meshHandler.render();
    handleFindChat();
}


// Handler for a new color selection
function handleColorChange(){
    let color = document.getElementById('color-picker').value;
    if (ChatInstance.isDataChannelOpen()) {
        ChatInstance.sendData("color," + color);
    }
    meshHandler.setPersonalColor(color);
}

// Handler function for clicking the 'Face-scan' button
function handleMediaAccess(){
    // disable the face-scan button to prevent double-firing
    userInterface.disableFaceScanButton();

    //display loading spinner for facemesh model loading
    userInterface.beginLoader();

    // get access to client media streams
    const stream = navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {

            videoTrack = stream.getVideoTracks();
            let videoStream = new MediaStream(videoTrack);
            let audioStream = new MediaStream(stream.getAudioTracks());

            prepLocalVideo(videoStream);
            ChatInstance.setAudioStream(audioStream);

            updateUIForMediaAccess();
        })
        .catch(error => {
            userInterface.endLoader();
            userInterface.showNoCameraAccessMessage();
            userInterface.enableFaceScanButton();
            console.log(error);
        });
}

function toggleVideoTrack(){

}

function handleFaceScanButton(){
    userInterface.toggleFaceScanButton();
    toggleVideoTrack();
    if (userInterface.state.facemesh_on) {
        if(localVideo.srcObject == null){
            handleMediaAccess();
        } else {
            callModelRenderLoop();
        }
    }
}

/* Handler function for when chat peer ends the current chat*/
function handleChatEnded(){
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

async function callModelRenderLoop(){
    if (userInterface.state.facemesh_on) {
        updateProfiler(0);
        let predictions = await model.estimateFaces(localVideo);
        updateProfiler(1);

        let facemesh;

        if (predictions.length > 0){
            facemesh = predictions[0].scaledMesh;
            meshHandler.updatePersonalMesh(facemesh);
            updateProfiler(2);

            if(ChatInstance.isDataChannelOpen()){
                ChatInstance.sendData(meshHandler.getPersonalMeshForTransit());
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
            //logProfiler();
        }
        requestAnimationFrame(callModelRenderLoop);
    } else {
        meshHandler.clearPersonalMesh();
        meshHandler.render();
    }
}

function main() {
    console.log('Running main() function');
    userInterface.disableFindChatButton(); // enabled when program has camera access
    /* give ChatInstance access to the client socket*/
    ChatInstance.setSocket(socket);

    /* add initial socket event handlers */
    socket.on('message', handleMessage);
    socket.on('offer', ChatInstance.onOffer);
    socket.on('chat-ended', handleChatEnded);
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('token', ChatInstance.onToken);


    /* Don't need to declare these variables because they're already declared in 'index.js' - just leaving here for readability */
    const faceScanButton = document.getElementById('face-scan');
    const findChatButton = document.getElementById('find-a-chat');
    const endChatButton = document.getElementById('end-chat');
    const newChatButton = document.getElementById('new-chat')
    const colorPicker = document.getElementById('color-picker');

    // Adding the 'click' event listener to the button and attaching the handler function
    findChatButton.addEventListener('click', handleFindChat);
    endChatButton.addEventListener('click', handleEndChat);
    newChatButton.addEventListener('click', handleNewChat);
    faceScanButton.addEventListener('click', handleFaceScanButton);
    colorPicker.addEventListener('change', handleColorChange);

    /* set init facemesh color to init color picker value*/
    let color = colorPicker.value;
    meshHandler.setPersonalColor(color);

    /* load the tensorflow facemesh model */
    loadModel();
}