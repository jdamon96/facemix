/* This script is responsible for interacting with the model and rendering the results of the model*/
"use strict"

let canvasName = "canvas";
let delta = 0.0; //WebGL Refresh Rate
let shaderProgram;
let glInitialized = false;
let canvas;
let gl;

const numFacePoints = 468
const numFaceCoordinates = numFacePoints * 3;
const decimalPrecision = 2 //Number of places to round decimals in model output to

const blueColor = [0.678, 0.847, .90]
const pinkColor = [1, .752, .796]
let unscaledVertices = [] //Represents all points currently being displayed on the canvas before local canvas sizing adjustments
let colors = []   //Corresponding colors of each point being displayed

let buttonOffsets = []  //Scalars to move the rendering based on key position
const buttonBounds = {x: {max: 1.0, min: -1.0}, y:{max: 1.0, min:-1.0}, z:{max:1.5, min:0.3}}
const buttonDelta = 0.1 //Amount a key press moves you within the canvas

/**********************************************************************/
/*************************PUBLIC FUNCTIONS*****************************/
/**********************************************************************/

export function getPersonalMeshForTransit() {
    let peerTransitMesh = []
    for (let i = 0; i < numFaceCoordinates; i++) {
        if (i % 3 == 0) { //x coordinate
            peerTransitMesh[i] = -unscaledVertices[i]
        } else {
            peerTransitMesh[i] = unscaledVertices[i]
        }
    }
    return peerTransitMesh
}

export function updatePersonalMesh(rawFacemesh) {
    const flattenedMesh = flattenMesh(rawFacemesh);
    const truncatedMesh = truncateMesh(flattenedMesh);
    const updatedVertices = translateMesh(truncatedMesh);

    if (unscaledVertices.length > numFaceCoordinates) {
        for (let i = numFaceCoordinates; i < unscaledVertices.length; i++) {
            updatedVertices[i] = unscaledVertices[i]
        }
    }
    unscaledVertices = updatedVertices
}

export function updatePeerMesh(transitMesh) {
    let updatedVertices = []
    for (let i = 0; i < numFaceCoordinates; i++) {
        updatedVertices[i] = unscaledVertices[i]
    }
    updatedVertices.push(...transitMesh)
    unscaledVertices = updatedVertices
}

export function render(){
    if (!glInitialized) {
        startWebGL();
    }
    const renderVertices = scaleMeshForLocalCanvas(unscaledVertices);
    drawObjects(renderVertices);
}

/**********************************************************************/
/***********************INTERNAL FUNCTIONS*****************************/
/**********************************************************************/

function handleKeyPress(e) {
    if (event.keyCode == 68) {
        console.log("right")
        updateOffset('x', buttonDelta, buttonBounds.x.max, buttonBounds.x.min)
    } else if (event.keyCode == 65) {
        console.log("left")
        updateOffset('x', -buttonDelta, buttonBounds.x.max, buttonBounds.x.min)
    } else if (event.keyCode == 87) {
        console.log("up")
        updateOffset('y', buttonDelta, buttonBounds.y.max, buttonBounds.y.min)
    } else if (event.keyCode == 83) {
        console.log("down")
        updateOffset('y', -buttonDelta, buttonBounds.y.max, buttonBounds.y.min)
    } else if (event.keyCode == 73) {
        console.log("forward");
        updateOffset('z', buttonDelta, buttonBounds.z.max, buttonBounds.z.min)
    } else if (event.keyCode == 75) {
        console.log("back");
        updateOffset('z', -buttonDelta, buttonBounds.z.max, buttonBounds.z.min)
    }
}

function updateOffset(dimension, delta, max, min) {
    const result = buttonOffsets[dimension] + delta
    if (result <= max && result >= min) {
        buttonOffsets[dimension] = result
    }
}

function populateColorsWithColor(color) {
    for (let i = 0; i < numFacePoints; i++) {
        colors.push(...color)
    }
}

function startWebGL(){
    canvas = document.getElementById(canvasName);
    document.onkeydown = handleKeyPress; // We can do this here because key presses don't matter until the model is rendered
    buttonOffsets['x'] = -0.5
    buttonOffsets['y'] = 0.5
    buttonOffsets['z'] = 1
    gl = canvas.getContext('experimental-webgl');
    populateColorsWithColor(blueColor);
    populateColorsWithColor(pinkColor);

    // vertex shader source code
    const vertCode =
        'precision mediump float; ' +
        'attribute vec3 a_Position; ' +
        'attribute vec3 a_Color; ' +
        'varying vec4 outColor; ' +
        'uniform float delta_x; ' +
        'uniform float angle; ' +


        'void main(void) { ' +
        'gl_Position = vec4(a_Position, 1.0); ' +    //Cast a_Position to a vec4
        'gl_Position.x = a_Position.x + delta_x; ' + //Update the xcomponent with delta_x
        'outColor = vec4(a_Color, 1.0); ' +
        'gl_PointSize = 4.0;' +

        '}';

    // fragment shader source code
    const fragCode =
        'precision mediump float; ' +
        'varying vec4 outColor; ' +

        'void main(void) { ' +
        'gl_FragColor = outColor; ' +
        '}';

    let vertShader = gl.createShader(gl.VERTEX_SHADER); // Create a vertex shader object
    gl.shaderSource(vertShader, vertCode); // Attach vertex shader source code
    gl.compileShader(vertShader);// Compile the vertex shader

    // Check for any compilation error
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(vertShader));
        return null;
    }

    let fragShader = gl.createShader(gl.FRAGMENT_SHADER);// Create fragment shader object
    gl.shaderSource(fragShader, fragCode); // Attach fragment shader source code
    gl.compileShader(fragShader); // Compile the fragment shader

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(fragShader));
        return null;
    }

    shaderProgram = gl.createProgram(); // Shader program object to store the combined shader program
    gl.attachShader(shaderProgram, vertShader);  // Attach a vertex shader
    gl.attachShader(shaderProgram, fragShader);  // Attach a fragment shader
    gl.linkProgram(shaderProgram); // Link both programs
    gl.useProgram(shaderProgram);
    resizeCanvas()
    glInitialized = true
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
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}


//TODO: Understand why points need to be negated to avoid inverting the mesh
//      Understand why 0.5 needs to be subtracted from each dimension to center it
//      Remove unneeded shader Code
//      Research best way to send new objects down to the vertex buffer
function drawObjects(renderVertices){
    //For EVERY attribute
    //create buffer, bind buffer, buffer data, vertAttribPointer(), enableVertAttribPointer()

    let vertex_buffer = gl.createBuffer(); // Create an empty buffer object to store the vertex buffer
    let coord = gl.getAttribLocation(shaderProgram, "a_Position"); // Get the attribute location
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); //Bind appropriate array buffer to it
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderVertices), gl.STATIC_DRAW);// Pass the vertex data to the buffer
    gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0); // Point an attribute to the currently bound VBO
    gl.enableVertexAttribArray(coord); // Enable the attribute

    let color_buffer = gl.createBuffer();
    let color = gl.getAttribLocation(shaderProgram, "a_Color");
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl. STATIC_DRAW);
    gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(color);

    gl.clearColor(1.0, 1.0, 1.0, 1.0);     // Clear the canvas
    gl.enable(gl.DEPTH_TEST);              // Enable the depth test
    gl.clear(gl.COLOR_BUFFER_BIT);         // Clear the color buffer bit

    gl.useProgram(shaderProgram);          // Use the program I created/compiled and Linked
    gl.uniform1f(gl.getUniformLocation(shaderProgram, 'delta_x'), delta); // stores value of delta into delta_x on GPU

    gl.drawArrays(gl.POINTS, 0, renderVertices.length/3); // execute the vertex/fragment shader on the bounded buffer, using the shaders and programs linked and compiled
}

/************************************
     Mesh Manipulation Functions
 ************************************/

function getCoordinateDivisors(scaledMesh) {
    let divisors = {maxX: -10000000, maxY: -10000000, maxZ:-10000000,
        minX: 10000000, minY: 10000000, minZ: 10000000,
        rangeX: 0, rangeY:0, rangeZ: 0}

    for (let i = 0; i < numFaceCoordinates; i+=3) {
        let x = scaledMesh[i]
        let y = scaledMesh[i+1]
        let z = scaledMesh[i+2]
        if (x > divisors.maxX) {
            divisors.maxX = x
        }
        if (x < divisors.minX) {
            divisors.minX = x
        }
        if (y > divisors.maxY) {
            divisors.maxY = y
        }
        if (y < divisors.minY) {
            divisors.minY = y
        }
        if (z > divisors.maxZ) {
            divisors.maxZ = z
        }
        if (z < divisors.maxZ) {
            divisors.minZ = z
        }
    }
    divisors.rangeX = divisors.maxX - divisors.minX
    divisors.rangeY = divisors.maxY - divisors.minY
    divisors.rangeZ = divisors.maxZ - divisors.minZ
    return divisors
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

function translateMesh(scaledMesh) {
    let meshPoints = []
    let divisors = getCoordinateDivisors(scaledMesh);

    const biggestRange = Math.max(divisors.rangeX, divisors.rangeY, divisors.rangeZ)

    for (let i = 0; i < numFaceCoordinates; i+=3) {
        let pointsRow = [
            -((scaledMesh[i] - divisors.minX) * buttonOffsets['z']) / biggestRange + buttonOffsets['x'],
            -((scaledMesh[i+1] - divisors.minY) * buttonOffsets['z']) / biggestRange + buttonOffsets['y'],
            -(scaledMesh[i+2] - divisors.minZ) / biggestRange
        ]
        meshPoints.push(...pointsRow)
    }
    return meshPoints
}

//Expects a flat mesh
function scaleMeshForLocalCanvas(unscaledMesh) {
    resizeCanvas();
    const scaledMesh = []
    const xScalar = canvas.height / canvas.width;
    for (let i = 0; i < unscaledMesh.length; i++) {
        if ((i % 3) === 0) {
            scaledMesh.push(unscaledMesh[i] * xScalar);
        } else {
            scaledMesh.push(unscaledMesh[i]);
        }
    }
    return scaledMesh;
}
