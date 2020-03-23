/********************************/
/* Import required code */
/********************************/

const adapter = require('webrtc-adapter');
import VideoCall from './js/VideoCall.js'

/********************************/
/* Declare required global variables */
/********************************/

/* true if currently in chat*/ 
var chatMode = false;

/* true if in process of finding a chat partner*/
var waitingForChat = false;

// if in a chat, this holds the current chat partner
var chatPartner = null;

//list of all partners that this client has chatted with during session
var sessionPartners = [];

var localMediaStream = null;

var peerMediaStream = null;


/********************************/
/* Define required functions */
/********************************/



/********************************/
/* Initial code run upon website load */
/********************************/


navigator.mediaDevices
    .getUserMedia({video: true, audio: true})
    .then(stream => {
        localMediaStream = stream;
        console.log(localMediaStream);
    })
    .catch(error => {
        console.log(error);
    })









/**********************************/
/* Button handlers and event listeners */
/**********************************/

var findChatButton = document.getElementById('find-chat');

findChatButton.addEventListener(
    'click',
    findChatHandler();
)

