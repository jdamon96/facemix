import * as userInterface from "./interface";
import * as meshHandler from "./meshHandler";
import Chat from "twilio/lib/rest/Chat";

export let ChatInstance = {
    peerConnection: null,
    localICECandidates: [],
    socket: null,
    currentRoom: null,
    audioStream: null,
    dataChannel: null,
    initiator: false,
    browserSupportsBufferEvents: false,
    browserSupportsBufferedAmount: false,
    outgoingMesh: null,

    setSocket: function(socket) {
        ChatInstance.socket = socket
        ChatInstance.socket.on('error', ChatInstance.onError);
        ChatInstance.socket.on('candidate', ChatInstance.onCandidate);
        ChatInstance.socket.on('answer', ChatInstance.onAnswer);
    },

    setRoom: function(room) {
        ChatInstance.currentRoom = room
    },

    setAudioStream: function(audio) {
        ChatInstance.audioStream = audio;
    },

    setInitiator: function(initiator) {
        ChatInstance.initiator = initiator
    },

    //Entry Point
    createPeerConnection: function(){
        ChatInstance.socket.emit('token');
    },

    resetChatInstance: function(){
        console.log('Resetting chat instance');
        ChatInstance.peerConnnection = null;
        ChatInstance.currentRoom = null;
        ChatInstance.initiator = false;
        ChatInstance.outgoingMesh = null;
        ChatInstance.dataChannel = null;
        ChatInstance.localICECandidates = [];
    },

    endCurrentChat: function(){
        //if there is a peerConnection
        if(ChatInstance.peerConnection != null){
            // let the chat peer know that you've ended the call
            ChatInstance.socket.emit('end-chat');

            // close the current peerConnection
            ChatInstance.peerConnection.close();

            // reset ChatInstance state variables
            ChatInstance.resetChatInstance();
            
        }
    },

    isDataChannelOpen() {
        return ChatInstance.dataChannel != null && ChatInstance.dataChannel.readyState == "open"
    },

    onOffer: function(offer){
        console.log('Received offer. Sending answer to peer.');
        ChatInstance.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
        ChatInstance.createAnswer();
    },

    createOffer: function(){
        console.log('Creating offer');

        ChatInstance.peerConnection.createOffer()
            .then(function(offer){
                ChatInstance.peerConnection.setLocalDescription(offer);
                ChatInstance.socket.emit('offer', {
                    room: ChatInstance.currentRoom,
                    offer: JSON.stringify(offer)
                });
            })
            .catch(function(err){
                console.log(err);
            });

    },

    createAnswer: function(){
        ChatInstance.peerConnection.createAnswer()
            .then(function(answer){
                ChatInstance.peerConnection.setLocalDescription(answer);
                ChatInstance.socket.emit('answer', {
                    room: ChatInstance.currentRoom,
                    answer: JSON.stringify(answer)
                });
            })
            .catch(function(err){
                console.log(err);
            });
    },

    lowSendBufferAmount: function(){
        ChatInstance.dataChannel.removeEventListener('bufferedamountlow', ChatInstance.lowSendBufferAmount)
        ChatInstance.safeSend(ChatInstance.outgoingMesh)
    },

    sendData: function(data){
        ChatInstance.outgoingMesh = data;
        if (ChatInstance.browserSupportsBufferedAmount) {
            if (ChatInstance.dataChannel.bufferedAmount > ChatInstance.bufferFullThreshold) { // Outgoing buffer amount confirmed too full

                if (ChatInstance.browserSupportsBufferEvents) {
                    // Wait for amount of buffered send data to be below threshold
                    ChatInstance.dataChannel.addEventListener('bufferedamountlow', ChatInstance.lowSendBufferAmount)
                } else {
                    // We can't know when the buffer will be below threshold without polling. So just skip this send
                    return;
                }
            } else { // Outgoing buffer amount confirmed not too full - send it
                ChatInstance.safeSend(data)
            }
        } else {
            // We have no visibility into the outgoing buffer amount - just guess and send 40% of the time
            if (Math.random() > 0.6) {
                ChatInstance.safeSend(data)
            }
        }
    },

    safeSend: function(data) {
        try {
            ChatInstance.dataChannel.send(data);
        } catch (e) {
            console.log("Failed to send with error", e)
        }
    },

    initiateDataChannel: function(channel){
        console.log('Setting up facemesh data channel');
        ChatInstance.dataChannel = channel;

        ChatInstance.dataChannel.addEventListener('open', event => {
            ChatInstance.bufferFullThreshold = 81920; //Slightly larger than the size of one facemesh send (~80k bytes)

            // Browser support found here https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold
            if (typeof ChatInstance.dataChannel.bufferedAmountLowThreshold === 'number'){
                // Because we can listen for buffered amount events, we can use a lower threshold for more efficient control
                ChatInstance.bufferFullThreshold = ChatInstance.bufferFullThreshold / 10;
                ChatInstance.dataChannel.bufferedAmountLowThreshold = ChatInstance.bufferFullThreshold;
                console.log("Browser supports buffer threshold events")
                ChatInstance.browserSupportsBufferEvents = true;
            }
            // Browser support found here https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmount
            if (typeof ChatInstance.dataChannel.bufferedAmount == 'number') {
                console.log("Browser supports reading the amount of data in the send buffer")
                ChatInstance.browserSupportsBufferedAmount = true
            }
        });

        ChatInstance.dataChannel.addEventListener('message', event => {
            userInterface.enableNewChatButton();
            let incomingData = event["data"].split(',')
            if(incomingData[0].includes("color")) {
                meshHandler.setPeerColor(incomingData[1]);
            } else {
                for (let i = 0; i < incomingData.length; i++) {
                    incomingData[i] = parseFloat(incomingData[i])
                }
                if (ChatInstance.isDataChannelOpen()) {
                    meshHandler.updatePeerMesh(incomingData);
                }
            }
        });

        ChatInstance.dataChannel.addEventListener('close', event => {
            console.log('Data channel closed', event);
        });
    },

    onError: function(error){
        console.log('Received error from server:');
        console.log(error);
    },

    onToken: function(token){
        console.log('firing onToken function');
        
        // Create the peer connection
        ChatInstance.peerConnection = new RTCPeerConnection({
            iceServers: token.iceServers
        });

        // attach handler for when a new track is added to the peer connection
        ChatInstance.peerConnection.addEventListener('track', ChatInstance.onTrackHandler);

        // Add user's local audio track to the peer connection
        let audioTracks = ChatInstance.audioStream.getAudioTracks();
        let audioTrack = audioTracks[0];
        ChatInstance.peerConnection.addTrack(audioTrack);

        // send any ice candidates to the other peer
        ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;
        console.log('Assigning this client to be initiator: ' + ChatInstance.initiator);
        if(ChatInstance.initiator){
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
            ChatInstance.createOffer();
        } else {
            ChatInstance.peerConnection.addEventListener('datachannel', event => {
                console.log('datachannel:', event.channel);
                ChatInstance.initiateDataChannel(event.channel);
            });
        }
    },


    onAnswer: function(answer){
        ChatInstance.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));

        ChatInstance.connected = true;

        // Take buffer of localICECandidates we've been saving and emit them now that connected to remote client
        ChatInstance.localICECandidates.forEach(candidate => {
            ChatInstance.socket.emit('candidate', {
                room: ChatInstance.currentRoom,
                candidate: JSON.stringify(candidate)
            });
        });

        //Clear the buffer now that we've offloaded the candidates to the remote client
        ChatInstance.localICECandidates = [];
    },

    onIceCandidate: function(event){
        if(event.candidate){
            const signalingState = ChatInstance.peerConnection.signalingState
            const description = ChatInstance.peerConnection.localDescription
            // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/signalingState
            if(signalingState == "have-local-offer" || signalingState == "stable" && description != null) {
                console.log('Generated candidate');
                ChatInstance.socket.emit('candidate', {
                    room: ChatInstance.currentRoom,
                    candidate: JSON.stringify(event.candidate)
                });
            } else {
                console.log("signaling state was ", signalingState)
                console.log("description was ", description)
                ChatInstance.localICECandidates.push(event.candidate)
            }
        }
    },

    onCandidate: function(candidate){
        let rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        console.log(rtcCandidate);
        if(rtcCandidate != null){
            ChatInstance.peerConnection.addIceCandidate(rtcCandidate);    
        }
    },

    onTrackHandler: function(event){
        remoteAudio.srcObject = new MediaStream([event.track]);
    }
};