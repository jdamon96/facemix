var VideoChat = {

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
    },

    noMediaStream: function(){
        console.log('No media stream available');
    }

};

VideoChat.videoButton = document.getElementById('get-video');

VideoChat.videoButton.addEventListener(
    'click',
    VideoChat.requestMediaStream,
    false
);