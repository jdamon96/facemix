var state = {
    media_access: false,
    popup_active: false,
    chat_mode: false,
    mobile_DOM: true
}

document.addEventListener("DOMContentLoaded", function(event){
    let mediaQueriesList = [
        window.matchMedia("(max-width: 550px)")
    ]

    //call mediaQueryHandler on initial load
    mediaQueriesHandler();

    for(let i=0; i < mediaQueriesList.length; i++){
        mediaQueriesList[i].addListener(mediaQueriesHandler);
    }

    function mediaQueriesHandler(){
        if(mediaQueriesList[0].matches){
            switchToMobileDom();
        } else {
            switchToDesktopDom();
        }
    }
});


/* Get access to HTML elements */
const header = document.getElementById('header');

const title = document.getElementById('title');
const aboutButton = document.getElementById('about');
const faceScanButton = document.getElementById('camera-access');
const findChatButton = document.getElementById('find-a-chat');

const newChatButton = document.getElementById('new-chat');
const endChatButton = document.getElementById('end-chat');

const overlay = document.getElementById('overlay');
const aboutPopUp = document.getElementById('about-message');
const noCamAccessPopUp = document.getElementById('no-camera-access-message');

const loader = document.getElementById('loader');
const colorPicker = document.getElementById('color-picker');


/* grouping of html elements */
let lobbyButtons = [title, aboutButton, faceScanButton, findChatButton];
let chatModeButtons = [endChatButton, newChatButton];
let chatButtons = [findChatButton, newChatButton, endChatButton, colorPicker];

/* Helper functions */ 

function onAboutEnterHandler(event){
    if(!state.popup_active){
        event.target.style.color = 'blue';
    }
}

function onAboutLeaveHandler(event){
    event.target.style.color = 'black';
}

function onFindChatEnterHandler(event){
    if(!state.popup_active){
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
    if(!state.popup_active){
        event.target.style.border = '1px solid blue';
        event.target.style.backgroundImage = 'url(\'./assets/BLUE-face-scan-icon.png\')';
    }
}

function onFaceScanLeaveHandler(event){
    event.target.style.border = '1px solid black';
    event.target.style.backgroundImage = 'url(\'./assets/face-scan-icon.png\')';
}



header.addEventListener('click', headerClickHandler);


aboutButton.addEventListener('click', aboutHandler);


overlay.addEventListener('click', containerClickHandler);
/* Define button onClick handler functions */

function headerClickHandler(event){
    const target_id = event.target.getAttribute('id');
    console.log(target_id);
    if(target_id == 'about-span'|| target_id == 'about'){
        
    } else {
        hidePopUpWindow();
    }
}

function aboutHandler(event){
    if(state.popup_active){
        /* if about is already active */ 
        console.log('already active')  ;
    }
    else {
        //event.target.style.backgroundColor = 'transparent';  
        showAboutWindow();
    }
}

function containerClickHandler(event){
    if(state.popup_active && !event.target.classList.contains('popup')){
        hidePopUpWindow();
    }
}


/* Define event listeners and attach handler functions */

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


/* Function to handle any keyboard functionality */

function dealWithKeyboard(event){
    const keyPressed = event.keyCode;
    
    if(keyPressed == 27){
        if(state.popup_active == true){
            hidePopUpWindow();
        }
    }
}


document.getElementById('mini-face-scan').addEventListener('mouseenter', function(event){
    this.src = "./assets/mini-face-scan-button-hover.png"
});

document.getElementById('mini-face-scan').addEventListener('mouseleave', function(event){
    this.src = "./assets/mini-face-scan-button.png"
});

document.getElementById('mini-find-chat').addEventListener('mouseenter', function(event){
    this.src = "./assets/mini-find-chat-button-hover.png"
});

document.getElementById('mini-find-chat').addEventListener('mouseleave', function(event){
    this.src = "./assets/mini-find-chat-button.png"
});

document.addEventListener("keydown", dealWithKeyboard);


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

function moveChatButtonsToFooter(){
    let footer = document.getElementById('footer');

    chatButtons.map(function(chatButton){
        footer.appendChild(chatButton);
    });
}

function changeChatButtonsClassForFooter(){
    chatButtons.map(function(chatButton){
        chatButton.classList.remove('header-button');
        chatButton.classList.add('footer-button');
    });
}

function moveChatButtonsToHeader(){
    let header = document.getElementById('header');

    chatButtons.map(function(chatButton){
        // check if button is find-a-chat button in which case need to make sure to insert before About for correct ordering of buttons in header
        if(chatButton.id == 'find-a-chat'){
            let faceScanButton = document.getElementById('camera-access');
            if(faceScanButton){
                header.insertBefore(chatButton, faceScanButton);    
            }
            else {
                let aboutButton = document.getElementById('about');
                header.insertBefore(chatButton, aboutButton);
            }
            
        } else {
            header.appendChild(chatButton);    
        }
        
    });
}

function changeChatButtonsClassForHeader(){
    chatButtons.map(function(chatButton){
        chatButton.classList.remove('footer-button');
        chatButton.classList.add('header-button');
    });
}

function switchToMobileDom(){
    if(!state.mobile_DOM){
        moveChatButtonsToFooter();
        changeChatButtonsClassForFooter();
    }
    state.mobile_DOM = true;
}

function switchToDesktopDom(){
    if(state.mobile_DOM){
        moveChatButtonsToHeader();
        changeChatButtonsClassForHeader();
    }
    state.mobile_DOM = false;
}

function showAboutWindow(){
    /* darken the window background */
    console.log('showing about');
    state.popup_active = true;
    overlay.style.display = 'inline';  
    /* display the about message */ 
    aboutPopUp.style.display = 'inline';
}

function showNoCameraAccessMessage(){
    console.log('showing no camera access msg');
    /* darken the window background */
    state.popup_active = true;
    overlay.style.display = 'inline';  
    /* display the about message */ 
    noCamAccessPopUp.style.display = 'inline';   
}

function hidePopUpWindow(){
    /* un-darken the window background */
    console.log('hiding popup');
    overlay.style.display = 'none';
    state.popup_active = false; 

    /* hide all the pop up messages (only one will be active at a time, but this catches all) */
    aboutPopUp.style.display = 'none'; 
    noCamAccessPopUp.style.display = 'none';
}


/**********************************************************************/
/*************************PUBLIC FUNCTIONS*****************************/
/**********************************************************************/

export { showNoCameraAccessMessage };

export function switchToChatUI(){
    if(!state.chat_mode){
        removeLobbyButtons();
        addChatButtons();
    }
    state.chat_mode = true;
}

export function switchToLobbyUI(){
    if(state.chat_mode){
        removeChatButtons();
        addLobbyButtons();
    }
    state.chat_mode = false;
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

export function removeFaceScanButton(){
    console.log("Removing face-scan button");
    faceScanButton.parentNode.removeChild(faceScanButton);
}

export function disableFaceScanButton(){
    console.log("Disabling face-scan button");
    faceScanButton.disabled = true;
    faceScanButton.style.opacity = 0.5;
}

export function enableFaceScanButton(){
    console.log("Enabling face-scan button");
    faceScanButton.disabled = false;
    faceScanButton.style.opacity = 1;
}

