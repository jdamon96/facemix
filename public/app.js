var VideoChat = {

    socket: io(),

    requestMediaStream: function(event){
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
        console.log('Got an offer');
        console.log(offer);
    },

    onToken: function(token){
        VideoChat.peerConnection = new RTCPeerConnection({
            iceServers: token.iceServers
        });

        VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;

        // We set up the socket listener for the 'candidate' event within this onToken function because this is when we create the peerConnection and will be ready to deal with candidates
        VideoChat.socket.on('candidate', VideoChat.onCandidate);

        VideoChat.peerConnection.addStream(VideoChat.localStream);
        VideoChat.peerConnection.createOffer(
            function(offer){
                VideoChat.peerConnection.setLocalDescription(offer);
                socket.emit('offer', JSON.stringify(offer));
            },
            function(err){
                console.log(err);
            }
        );
    },

    onIceCandidate: function(event){
        if(event.candidate){
            console.log('Generated candidate');
            VideoChat.socket.emit('candidate', JSON.stringify(event.candidate));
        }
    },

    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        VideoChat.peerConnection.addIceCandidate(rtcCandidate);
    }

    readyToCall: function(event){
        VideoChat.callButton.removeAttribute('disabled');
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){
        VideoChat.socket.on('token', VideoChat.onToken);
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