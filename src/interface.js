var state = {
    media_access: false,
    about_active: false,
    chat_mode: false
}

/* Get access to HTML elements */
const header = document.getElementById('header');

const title = document.getElementById('title');
const aboutButton = document.getElementById('about');
const faceScanButton = document.getElementById('camera-access');
const findChatButton = document.getElementById('find-a-chat');

const endChatButton = document.getElementById('end-chat');
const newChatButton = document.getElementById('new-chat');

const overlay = document.getElementById('overlay');
const aboutMessage = document.getElementById('about-message');

const loader = document.getElementById('loader');


/* grouping of html elements */
let lobbyButtons = [title, aboutButton, faceScanButton, findChatButton];
let chatModeButtons = [endChatButton, newChatButton];

/* Helper functions */ 

function onAboutEnterHandler(event){
    if(!state.about_active){
        event.target.style.color = 'blue';
    }
}

function onAboutLeaveHandler(event){
    event.target.style.color = 'black';
}

function onFindChatEnterHandler(event){
    if(!state.about_active){
        event.target.style.backgroundColor = '#EFFDEA';
    }
}

function onFindChatLeaveHandler(event){
    event.target.style.backgroundColor = '#FFFFFF';
}

function onNewChatEnterHandler(event){
    event.target.style.backgroundColor = '#EFFDEA';
}

function onNewChatLeaveHandler(event){
    event.target.style.backgroundColor = '#FFFFFF';
}

function onEndChatEnterHandler(event){
    event.target.style.backgroundColor = '#FFE8E8';
}

function onEndChatLeaveHandler(event){
    event.target.style.backgroundColor = '#FFFFFF';
}


function onFaceScanEnterHandler(event){
    if(!state.about_active){
        event.target.style.border = '1px solid blue';
        event.target.style.backgroundImage = 'url(\'./assets/BLUE-face-scan-icon.png\')';
    }
}

function onFaceScanLeaveHandler(event){
    event.target.style.border = '1px solid black';
    event.target.style.backgroundImage = 'url(\'./assets/face-scan-icon.png\')';
}



function showAboutWindow(){
    /* darken the window background */
    console.log('showing about');
    state.about_active = true;
    overlay.style.display = 'inline';  
    /* display the about message */ 
}

function hideAboutWindow(){
    /* un-darken the window background */
    overlay.style.display = 'none';
    state.about_active = false; 
    
    /* display the about message */ 

}

/* Define button onClick handler functions */

function headerClickHandler(event){
    const target_id = event.target.getAttribute('id');
    
    if(target_id == 'about-span'|| target_id == 'about'){
        
    } else {
        hideAboutWindow();
    }
}

function aboutHandler(event){
    if(state.about_active){
        /* if about is already active */ 
        console.log('already active')  ;
    }
    else {
        //event.target.style.backgroundColor = 'transparent';  
        showAboutWindow();
    }
}

function containerClickHandler(event){
    // Handle case where the about window itself is clicked
    /*
    if(event.target == 'aboutWindow'){
        // do nothing
    } 
    */
    console.log('container click');
    if(state.about_active && event.target.id != 'about' && event.target.id != 'about-message'){
        hideAboutWindow();
    }
}


/* Define event listeners and attach handler functions */
overlay.addEventListener('click', containerClickHandler);

aboutButton.addEventListener('click', aboutHandler);

aboutButton.addEventListener('mouseenter', onAboutEnterHandler);
aboutButton.addEventListener('mouseleave', onAboutLeaveHandler);

faceScanButton.addEventListener('mouseenter', onFaceScanEnterHandler);
faceScanButton.addEventListener('mouseleave', onFaceScanLeaveHandler);

findChatButton.addEventListener('mouseenter', onFindChatEnterHandler);
findChatButton.addEventListener('mouseleave', onFindChatLeaveHandler);

endChatButton.addEventListener('mouseenter', onEndChatEnterHandler);
endChatButton.addEventListener('mouseleave', onEndChatLeaveHandler);

newChatButton.addEventListener('mouseenter', onNewChatEnterHandler);
newChatButton.addEventListener('mouseleave', onNewChatLeaveHandler);

header.addEventListener('click', headerClickHandler);


/* Function to handle any keyboard functinality */

function dealWithKeyboard(event){
    const keyPressed = event.keyCode;

    if(keyPressed == 27){
        if(state.about_active == true){
            hideAboutWindow();
        }
    }
}


document.getElementById('mini-face-scan').addEventListener('mouseenter', function(event){
    this.src = "./assets/BLUE-mini-face-scan-button.png"
});

document.getElementById('mini-face-scan').addEventListener('mouseleave', function(event){
    this.src = "./assets/mini-face-scan-button.png"
});

document.getElementById('mini-find-chat').addEventListener('mouseenter', function(event){
    this.src = "./assets/BLUE-mini-find-chat-button.png"
});

document.getElementById('mini-find-chat').addEventListener('mouseleave', function(event){
    this.src = "./assets/mini-find-chat-button.png"
});

document.addEventListener("keydown", dealWithKeyboard);


/**********************************************************************/
/*************************PUBLIC FUNCTIONS*****************************/
/**********************************************************************/

/*
* UI controlling functions
*/

function removeLobbyButtons(){
    lobbyButtons.map(function(lobbyButton){
        lobbyButton.style.display = 'none';
    })
}

function addLobbyButtons(){
    lobbyButtons.map(function(lobbyButton){
        lobbyButton.style.display = 'inline-block';
    });
}

function removeChatButtons(){
    chatModeButtons.map(function(chatButton){
        chatButton.style.display = 'none';
    });   
}

function addChatButtons(){
    chatModeButtons.map(function(chatButton){
        chatButton.style.display = 'inline-block';
    });   
}

/** EXPORTED FUNCTIONS **/


export function switchToChatUI(){
    removeLobbyButtons();
    addChatButtons();
}

export function switchToLobbyUI(){
    removeChatButtons();
    addLobbyButtons();
}

export function beginLoader(){
    loader.style.display = 'block';
}

export function endLoader(){
    loader.style.display = 'none';
}

export function enableFindChatButton(){
    // enable the find chat button
    findChatButton.disabled = false;

    findChatButton.style.opacity = 1;
}

export function disableFindChatButton(){
    findChatButton.disabled = true;
    findChatButton.style.opacity = 0.5;
}

export function enableNewChatButton(){
    // enable the find chat button
    newChatButton.disabled = false;

    newChatButton.style.opacity = 1;    
}

export function disableNewChatButton(){
    newChatButton.disabled = true;
    newChatButton.style.opacity = 0.5;
}

export function disableFaceScanButton(){
    faceScanButton.disabled = true;
    faceScanButton.style.opacity = 0.5;
}

