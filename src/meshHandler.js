//Copyright Placeholder
/* This script is responsible for interacting with the model and rendering the results of the model*/
"use strict"
export const canvasName = "canvas"
export const canvas = document.getElementById(canvasName);
const decimalPrecision = 3 //Number of places to round decimals in model output to

import {WebGLEngine} from "./webGLEngine";
import {CanvasEngine} from "./canvasEngine";

const graphicsEngine = CanvasEngine; //Any graphics engine must implement all public functions below
configureGraphicsEngine();

document.onkeydown = handleKeyPress;

/**********************************************************************/
/*************************PUBLIC FUNCTIONS*****************************/
/**********************************************************************/

export function getPersonalMeshForTransit() {
    return graphicsEngine.getPersonalMeshForTransit()
}

export function updatePersonalMesh(rawFacemesh) {
    graphicsEngine.updatePersonalMesh(rawFacemesh);
}

export function updatePeerMesh(transitMesh) {
    graphicsEngine.updatePeerMesh(transitMesh);
}

export function render(){
    resizeCanvas()
    graphicsEngine.render();
}

export function setPersonalColor(color) {
    graphicsEngine.setPersonalColor(color)
}

export function setPeerColor(color) {
    graphicsEngine.setPeerColor(color)
}

/**********************************************************************/
/*******************SHARED GRAPHICS ENGINE FUNCTINOS*******************/
/**********************************************************************/

function handleKeyPress(e) {
    if (event.keyCode == 68) { //d: right
        graphicsEngine.updateOffset('x', true)
    } else if (event.keyCode == 65) { //a: left
        graphicsEngine.updateOffset('x', false)
    } else if (event.keyCode == 87) { //w: up
        graphicsEngine.updateOffset('y', true)
    } else if (event.keyCode == 83) { //s: down
        graphicsEngine.updateOffset('y', false)
    } else if (event.keyCode == 73) { //i: forward
        graphicsEngine.updateOffset('z', true)
    } else if (event.keyCode == 75) { //k: back
        graphicsEngine.updateOffset('z', false)
    }
}

function resizeCanvas() {
    // Lookup the size the browser is displaying the canvas.
    let displayWidth  = canvas.clientWidth;
    let displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    if (canvas.width  != displayWidth ||
        canvas.height != displayHeight) {

        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
    }
    if (graphicsEngine.isGlInitialized) {
        graphicsEngine.graphicsResizeOccurred();
    }
}


//Expects a nested mesh
function flattenMesh(nestedMesh) {
    let flattenedMesh = []
    for (let i = 0; i < nestedMesh.length; i++) {
        flattenedMesh.push(...nestedMesh[i])
    }
    return flattenedMesh
}

//Expects a flat mesh
function truncateMesh(flattenedMesh) {
    let truncatedMesh = []
    const roundConstant = 10 ** decimalPrecision
    for (let i = 0; i < flattenedMesh.length; i++) {
        truncatedMesh[i] = Math.round(flattenedMesh[i] * roundConstant) / roundConstant;
    }
    return truncatedMesh
}

function configureGraphicsEngine() {
    graphicsEngine.flattenMesh = flattenMesh;
    graphicsEngine.truncateMesh = truncateMesh;
    graphicsEngine.hexToRGB = hexToRGB;
}

function hexToRGB(hex) {
    console.log("raw hex", hex)
    console.log("sub", hex.substring(1))
    let bigint = parseInt(hex.substring(1), 16);
    console.log("bigint", bigint)
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return [r,g,b];
}



