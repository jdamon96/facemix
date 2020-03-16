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
    },

    readyToCall: function(event){
        VideoChat.callButton.removeAttribute('disabled');
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){
        console.log('things are going as planned');
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