import * as userInterface from "./interface";
import * as meshHandler from "./meshHandler";

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
        ChatInstance.peerConnection.createOffer(
            function(offer){
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

    sendFacemeshData: function(transitMesh){
        ChatInstance.dataChannel.send(transitMesh);
    },

    initiateDataChannel: function(channel){
        console.log('Setting up facemesh data channel');
        ChatInstance.dataChannel = channel;

        ChatInstance.dataChannel.addEventListener('open', event => {
            ChatInstance.connected = true
            ChatInstance.shouldSendFacemeshData = true
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
            console.log('Data channel closed');
        });
    },

    createPeerConnection: function(){
        ChatInstance.socket.on('token', ChatInstance.onToken(ChatInstance.audioStream));
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
                console.log('Creating an offer')
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