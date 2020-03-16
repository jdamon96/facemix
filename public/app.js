import adapter from 'webrtc-adapter';

var VideoChat = {
    connected: false,
    localICECandidates: [],

    socket: io(),

    requestMediaStream: function(event){
        alert('u jsut clicked');
        navigator.mediaDevices
            .getUserMedia({video: true, audio: true})
            .then(stream => {
                VideoChat.onMediaStream(stream);
            })
            .catch(error => {
                VideoChat.noMediaStream(error);
            });
    },

    onMediaStream: function(stream){
        VideoChat.localVideo = document.getElementById('local-video');
        VideoChat.localVideo.volume = 0;
        VideoChat.localStream = stream;
        VideoChat.videoButton.setAttribute('disabled', 'disabled');
        VideoChat.localVideo.srcObject = stream;
        VideoChat.socket.emit('join', 'test');
        VideoChat.socket.on('ready', VideoChat.readyToCall);
        VideoChat.socket.on('offer', VideoChat.onOffer);
    },

    onOffer: function(offer){
        VideoChat.socket.on('token', VideoChat.onToken(VideoChat.createAnswer(offer)));
        VideoChat.socket.emit('token');
    },

    createOffer: function(){
        VideoChat.peerConnection.createOffer(
            function(offer){
                VideoChat.peerConnection.setLocalDescription(offer);
                VideoChat.socket.emit('offer', JSON.stringify(offer));
            },
            function(err){
                console.log(err);
            }
        );
    },

    createAnswer: function(offer){
        return function(){
            VideoChat.connected = true;
            rtcOffer = new RTCSessionDescription(JSON.parse(offer));
            VideoChat.peerConnection.setRemoteDescription(rtcOffer);
            VideoChat.peerConnection.createAnswer(
                function(answer){
                    VideoChat.peerConnection.setLocalDescription(answer);
                    VideoChat.socket.emit('answer', JSON.stringify(answer));
                },
                function(err){
                    console.log(err);
                }
            );
        }
    },

    onToken: function(callback){
        return function(token){
            VideoChat.peerConnection = new RTCPeerConnection({
                iceServers: token.iceServers
            });

            VideoChat.peerConnection.addStream(VideoChat.localStream);
            VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;
            VideoChat.peerConnection.onaddstream = VideoChat.onAddStream;
            // We set up the socket listener for the 'candidate' event within this onToken function because this is when we create the peerConnection and will be ready to deal with candidates
            VideoChat.socket.on('candidate', VideoChat.onCandidate);
            VideoChat.socket.on('answer', VideoChat.onAnswer);
            callback();
        }
    },

    onAddStream: function(event){
        VideoChat.remoteVideo = document.getElementById('remote-video');
        VideoChat.remoteVideo.srcObject = event.stream;
    },

    onAnswer: function(answer){
        var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
        VideoChat.peerConnection.setRemoteDescription(rtcAnswer);
        // Set connected to true
        VideoChat.connected = true;
        // Take buffer of localICECandidates and emit now that connected
        VideoChat.localICECandidates.forEach(candidate => {
            VideoChat.socket.emit('candidate', JSON.stringify(candidate));
        });
        // Re-initialize buffer to empty
        VideoChat.localICECandidates = [];
    },

    /* 
    ** Here we check if the VideoChat is connected before sending the candidate to the server.
    ** If the VideoChat is not connected, then we add them to a local buffer (the array localICECandidates)
    */
    onIceCandidate: function(event){
        if(event.candidate){
            if(VideoChat.connected){
                console.log('Generated candidate');  
                VideoChat.socket.emit('candidate', JSON.stringify(event.candidate));
            } else {
                VideoChat.localICECandidates.push(event.candidate)
            }
        }
    },

    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        VideoChat.peerConnection.addIceCandidate(rtcCandidate);
    },

    readyToCall: function(event){
        VideoChat.callButton.removeAttribute('disabled');
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){
        VideoChat.socket.on('token', VideoChat.onToken(VideoChat.createOffer));
        VideoChat.socket.emit('token');
    }

};

// get references to DOM button objects
VideoChat.videoButton = document.getElementById('get-video');
VideoChat.callButton = document.getElementById('call');

// add event listeners to DOM button objects
VideoChat.videoButton.addEventListener(
    'click',
    VideoChat.requestMediaStream,
    false
);

VideoChat.callButton.addEventListener(
  'click',
  VideoChat.startCall,
  false
);