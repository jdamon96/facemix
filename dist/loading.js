/**********************************
           Page On Load 
**********************************/

window.addEventListener('load', event => {
    let preload = document.getElementById('preload-container');
    preload.style.display = 'none';

    let app = document.getElementById('app-container');
    app.style.display = 'grid';
});