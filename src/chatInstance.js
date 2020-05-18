import * as userInterface from "./interface";
import * as meshHandler from "./meshHandler";
import Chat from "twilio/lib/rest/Chat";

export let ChatInstance = {
    peerConnection: null,
    connected: false,
    shouldSendFacemeshData: false,
    localICECandidates: [],
    socket: null,
    currentRoom: null,
    audioStream: null,
    dataChannel: null,
    initiator: false,
    browserSupportsBufferEvents: false,
    browserSupportsBufferedAmount: false,
    outgoingMesh: null,
    lowBufferAmount: 262144,

    setSocket: function(socket) {
        ChatInstance.socket = socket
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
        console.log('Received offer. Sending answer to peer.');
        ChatInstance.peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)))
        ChatInstance.createAnswer();
    },

    createOffer: function(){
        console.log('Creating offer');
        ChatInstance.peerConnection.createOffer(
            function(offer){
                console.log(offer);
                ChatInstance.peerConnection.setLocalDescription(offer);
                ChatInstance.socket.emit('offer', {
                    room: ChatInstance.currentRoom,
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
                ChatInstance.socket.emit('answer', {
                    room: ChatInstance.currentRoom,
                    answer: JSON.stringify(answer)
                });
            },
            function(err){
                console.log(err);
            }
        );
    },

    lowSendBufferAmount: function(){
        console.log("Retroactive send")
        ChatInstance.dataChannel.removeEventListener('bufferedamountlow', ChatInstance.lowSendBufferAmount)
        ChatInstance.dataChannel.send(ChatInstance.outgoingMesh)
    },

    sendFacemeshData: function(transitMesh){
        ChatInstance.outgoingMesh = transitMesh;
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
                console.log("Happy case")
                ChatInstance.dataChannel.send(transitMesh);
            }
        } else {
            // We have no visibility into the outgoing buffer amount - just guess and send 40% of the time
            if (Math.random() > 0.6) {
                ChatInstance.dataChannel.send(transitMesh)
            }
        }
    },

    initiateDataChannel: function(channel){
        console.log('Setting up facemesh data channel');
        ChatInstance.dataChannel = channel;

        ChatInstance.dataChannel.addEventListener('open', event => {
            ChatInstance.connected = true
            ChatInstance.shouldSendFacemeshData = true
            ChatInstance.bufferFullThreshold = 81920; //Slightly larger than the size of one facemesh send (~80k bytes)

            // Browser support found here https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold
            if (typeof ChatInstance.dataChannel.bufferedAmountLowThreshold === 'number'){
                //Because we can listen for buffered amount events, we can use a lower threshold for more efficient control
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
            let incomingMesh = event["data"].split(',')
            for (let i = 0; i < incomingMesh.length; i++) {
                incomingMesh[i] = parseFloat(incomingMesh[i])
            }
            meshHandler.updatePeerMesh(incomingMesh);
        });

        ChatInstance.dataChannel.addEventListener('close', event => {
            console.log('Data channel closed', event);
        });
    },

    onError: function(error){
        console.log('Recieved error from server:');
        console.log(error);
    },

    createPeerConnection: function(){
        ChatInstance.socket.on('token', ChatInstance.onToken(ChatInstance.audioStream));
        ChatInstance.socket.on('error', ChatInstance.onError);
        ChatInstance.socket.emit('token');
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
            ChatInstance.socket.on('candidate', ChatInstance.onCandidate);
            ChatInstance.socket.on('answer', ChatInstance.onAnswer);
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
            if(ChatInstance.connected){
                console.log('Generated candidate');
                ChatInstance.socket.emit('candidate', {
                    room: ChatInstance.currentRoom,
                    candidate: JSON.stringify(event.candidate)
                });
            } else {
                ChatInstance.localICECandidates.push(event.candidate)
            }
        }
    },

    onCandidate: function(candidate){
        let rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        ChatInstance.peerConnection.addIceCandidate(rtcCandidate);
    },

    onTrackHandler: function(event){
        remoteAudio.srcObject = new MediaStream([event.track]);
    }
};