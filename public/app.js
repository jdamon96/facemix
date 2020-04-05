/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');

/********************************/
/* Declare required global variables */
/********************************/

/* true if currently in chat*/ 
var chatMode = false;

/* true if in process of finding a chat partner*/
var waitingForChat = false;

// if in a chat, this holds the current chat partner
var chatPartner = null;

// client role can be HOST or GUEST. 
//      HOST creates rooms and initiates RTC Peer Connection (sends offer)
//      GUEST recieves room invitations and responds to RTCPeerConnection offer (sends answer)
var role = '';

//list of all partners that this client has chatted with during session
var sessionPartners = [];

//initializing variable that will hold the facemesh model
var model;

//initializing the socket.io handle
var socket = io();

/********************************/
/* Define required functions */
/********************************/


/*
* Handler function for recieving 'message' events emitted by other sockets
*/
function handleMessage(message){

    switch(message.title){

        /** if the message title is 'waiting'... **/
        case 'waiting':
            //set waitingForChat variable to the message's content
            waitingForChat = message.content;
            console.log('Waiting for chat partner: ' + waitingForChat);
            break;

        case 'role-update':
            role = message.role
            break;

        case 'text-message':
            console.log('New text message:');
            console.log(message.content)
            break;

        case: 'room-ready':
            console.log('Room is ready for initiating RTCPeerConnection between clients');
            if(role == 'HOST'){
                chatInstance.startCall();
            }
            break;
    }
}


/*
* StartCall initiates the RTCPeerConnection between the clients in the same room
*/



/*
* Handler function for recieving 'roomInvitation' events emitted by other sockets
*/
function handleRoomInvitation(roomInvitation){
    if(socket.id === roomInvitation.recipient){
        role = 'GUEST';
        console.log('Found chat partner');
        socket.emit('join', roomInvitation.roomname);
    }
}

/********************************/
/* Facemesh model related functions*/
/********************************/
async function loadModelInternal() {
    model = await facemesh.load();
}

async function getScaledMesh(localVideo) {
    const video = localVideo;
    //console.log('estimating faces...');
    const faces = await model.estimateFaces(video);
    //console.log('done estimating faces');
    return faces[0].scaledMesh;
}

async function logScaledMesh(localVideo) {
    setInterval(async () => {
        var scaledMesh = await getScaledMesh(localVideo);
        //console.log(scaledMesh);
        /*await drawObjects(scaledMesh, canvases[canvasNames.clientCanvas].gl);*/
    }, 100);
}



/********************************/
/* Initial code run upon website load */
/********************************/

/* Add message event handler for client socket*/
socket.on('message', handleMessage);

/* Load facemesh model */
loadModelInternal();



/**********************************/
/*        WebRTC Setup Code       */
/**********************************/

/*
* This 'ChatInstance' object is responsible for setting up and managing the RTCPeer Connections
*/ 


var ChatInstance = {
    connected: false,
    localICECandidates: [],

    onOffer: function(offer){
        socket.on('token', ChatInstance.onToken(ChatInstance.createAnswer(offer)));
        socket.emit('token');
    },

    createOffer: function(){
        ChatInstance.peerConnection.createOffer(
            function(offer){
                ChatInstance.peerConnection.setLocalDescription(offer);
                socket.emit('offer', JSON.stringify(offer));
            },
            function(err){
                console.log(err);
            }
        );
    },

    createAnswer: function(offer){
        return function(){
            ChatInstance.connected = true;
            rtcOffer = new RTCSessionDescription(JSON.parse(offer));
            ChatInstance.peerConnection.setRemoteDescription(rtcOffer);
            ChatInstance.peerConnection.createAnswer(
                function(answer){
                    ChatInstance.peerConnection.setLocalDescription(answer);
                    socket.emit('answer', JSON.stringify(answer));
                },
                function(err){
                    console.log(err);
                }
            );
        }
    },

    onToken: function(callback){
        return function(token){
            /*
            * Initialize a new RTCPeerConnection using iceServers supplied from Twilio token
            */

            ChatInstance.peerConnection = new RTCPeerConnection({
                iceServers: token.iceServers
            });

            /*
            * ChatInstance.peerConnection.addStream(ChatInstance.localStream);
            */
            
            /*
            * Attach handler for peerConnection onIceCandidate event
            */
            ChatInstance.peerConnection.onicecandidate = ChatInstance.onIceCandidate;

            /*
            * ChatInstance.peerConnection.onaddstream = ChatInstance.onAddStream;
            */

            /*
            * We set up the socket listener for the 'candidate' event within this onToken function 
            * because this is when we create the peerConnection and will be ready to deal with 
            * candidates
            */ 

            /*
            * Set up socket event-listeners and attach event-handler for CANDIDATE and ANSWER events
            *
            * Note: we set up these event listener/handlers within this onToken function
            * because we create the RTCPeerConnection inside this function and we are not ready
            * to listen for / handle the CANDIDATE and ANSWER events until we have created the 
            * RTCPeerConnection
            */
            socket.on('candidate', ChatInstance.onCandidate);
            socket.on('answer', ChatInstance.onAnswer);

            /*
            * Call the supplied callback function
            *
            * NOTE: 
            *   - The reason we're using this design pattern of passing a callback to the onToken function
            *   and calling this callback at the end of the function is that clients need to use the onToken function both when they're
            *   creating an RTCPeerConnection Offer _and_ Answer
            *  
            *   - We enable this flexible use of the onToken function by accepting a callback function, and then when we call onToken we either pass
            *   a createOffer callback or createAnswer callback depending on the context 
            */ 
            callback();
        }
    },

    /*
    onAddStream: function(event){
        ChatInstance.remoteVideo = document.getElementById('remote-video');
        ChatInstance.remoteVideo.srcObject = event.stream;
    },
    */

    /*
    * Handler function for recieving an ANSWER 
    * - Sets remote client session description of RTCPeerConnection 
    * - Update 'connected' to true
    * - Send ICECandidates to remote client from localICeCandidate buffer
    * - clear localIceCandidate buffer
    */ 
    onAnswer: function(answer){
        /*
        * Create an RTCSessionDescription of the remote client using the answer
        */
        var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));

        /*
        * Set the remote description of our RTCPeerConnection to the RTCSessionDescription of the remote clinet
        */
        ChatInstance.peerConnection.setRemoteDescription(rtcAnswer);

        /*
        * Update 'connected' boolean to True
        */
        ChatInstance.connected = true;

        /*
        * Take buffer of localICECandidates we've been saving and emit them now that connected to remote client
        */ 
        ChatInstance.localICECandidates.forEach(candidate => {
            socket.emit('candidate', JSON.stringify(candidate));
        });

        /*
        *  Clear the buffer now that we've offloaded the candidates to the remote client
        */
        ChatInstance.localICECandidates = [];
    },

    
    // Here we check if the ChatInstance is connected before sending the candidate to the server.
    // If the ChatInstance is not connected, then we add them to a local buffer (the array localICECandidates)
    
    /*
    * Handle recieving potential ICECandidates
    * - If chatInstance is connected
        - Send candidate directly to server which will relay to peer client
    * - If chatInstance is NOT connected
        - Add candidate to localICECandidates buffer which be offloaded and relayed to client 
        when chatInstance becomes connected
    */
    onIceCandidate: function(event){
        if(event.candidate){
            if(ChatInstance.connected){
                console.log('Generated candidate');  
                socket.emit('candidate', JSON.stringify(event.candidate));
            } else {
                ChatInstance.localICECandidates.push(event.candidate)
            }
        }
    },

    /*
    * Handle recieving ICECandidates from the other client
    *   - create new IceCandidate from data sent
    *   - add IceCandidate to our Chat Instance's RTCPeerConnection
    */
    onCandidate: function(candidate){
        rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
        ChatInstance.peerConnection.addIceCandidate(rtcCandidate);
    },

    noMediaStream: function(){
        console.log('No media stream available');
    },

    startCall: function(event){
        socket.on('token', ChatInstance.onToken(ChatInstance.createOffer));
        socket.emit('token');
    }

};


/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');
var cameraToggleButton = document.getElementById('camera-toggle');

var localVideo = document.getElementById('videoElement');


/*
* Event handler for event that occurs when the video element has successfully loaded video data given to it
*/ 
function handleLoadedVideoData(event){
    console.log('video data loaded');
    
    //var video = event.target;
    //logScaledMesh(video);
}

/*
* Adding the event listner and attaching the handler function
*/
localVideo.addEventListener(
    'loadeddata',
    handleLoadedVideoData
)

/* disable 'find chat' button if no access to client media feed 
* ( can't join chat if you don't have your camera on )*/
if(localVideo.srcObject == null){
    findChatButton.disabled = true;
}


function handleRoomJoin(data){
    console.log(data);
}


/*
* Handler function for clicking the 'Find-Chat' button
*/
function handleFindChat(){
    socket.emit('join');
    socket.on('roominvitation', handleRoomInvitation);
    socket.on('roomjoined', handleRoomJoin);
}

/*
* Adding the 'click' event listener to the button and attaching the handler function
*/

findChatButton.addEventListener(
    'click',
    handleFindChat
);

/*
* Handler function for the camera button
*/
function handleCameraToggle(){

    // get access to client media streams
    navigator.mediaDevices
        .getUserMedia({video: true, audio: true})
        .then(stream => {
            console.log('Media stream acquired');
            localVideo.srcObject = stream;        
        })
        .catch(error => {
            console.log('No media stream');
            console.log(error);
        });

    // enable the find chat button
    findChatButton.disabled = false;

}

cameraToggleButton.addEventListener(
    'click',
    handleCameraToggle
);