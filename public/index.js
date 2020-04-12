var state = {
    media_access: false,
    about_active: false,
    chat_mode: false,
    chat_room: ''
}

/* Get access to HTML elements */
const overlay = document.getElementById('overlay')
const aboutButton = document.getElementById('about');
const faceScanButton = document.getElementById('camera-access');
const findChatButton = document.getElementById('find-a-chat');
const header = document.getElementById('header');
const aboutMessage = document.getElementById('about-message')

/* Helper functions */ 

function onAboutEnterHandler(event){
    if(!state.about_active){
        event.target.style.color = 'blue';
    }
}

function onAboutLeaveHandler(event){
    event.target.style.color = 'black';
}

function onButtonEnterHandler(event){
    console.log('enter');
    if(!state.about_active){
        event.target.style.color = 'blue';
        event.target.style.border = '1px solid blue';
    }
}

function onButtonLeaveHandler(event){
    console.log('leave');
    event.target.style.color = 'black';
    event.target.style.border = '1px solid black';
}


function onFaceScanEnterHandler(event){
    console.log('enter');
    if(!state.about_active){
        event.target.style.border = '1px solid blue';
        event.target.style.backgroundImage = 'url(\'./assets/BLUE-face-scan-icon.png\')';
    }
}

function onFaceScanLeaveHandler(event){
    console.log('leave');
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
    if(state.about_active && event.target.id != 'about'){
        hideAboutWindow();
    }
}

/* Define event listeners and attach handler functions */
overlay.addEventListener('click', containerClickHandler)

aboutButton.addEventListener('click', aboutHandler);

aboutButton.addEventListener('mouseenter', onAboutEnterHandler);
aboutButton.addEventListener('mouseleave', onAboutLeaveHandler);

faceScanButton.addEventListener('mouseenter', onFaceScanEnterHandler);
faceScanButton.addEventListener('mouseleave', onFaceScanLeaveHandler);

findChatButton.addEventListener('mouseenter', onButtonEnterHandler);
findChatButton.addEventListener('mouseleave', onButtonLeaveHandler);

header.addEventListener('click', headerClickHandler);



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
