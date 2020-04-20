/* This script is responsible for interacting with the model and rendering the results of the model*/
"use strict"

var canvasName = "canvas";
let delta = 0.0; //WebGL Refresh Rate
var shaderProgram;
var glInitialized = false;
var canvas;
var gl;

const numFaceVertices = 468
const numFaceCoordinates = numFaceVertices * 3;
const blueColor = [0.678, 0.847, .90]
const pinkColor = [1, .752, .796]
var vertices = [] //Represents all points currently being displayed on the canvas
var colors = []   //Corresponding colors of each point being displayed

/**********************************************************************/
/**********************************************************************/
/*************************PUBLIC FUNCTIONS*****************************/
/**********************************************************************/
/**********************************************************************/

exports.updateOutgoingMesh = function updateOutgoingMesh(mesh) {
    let points = translateMesh(mesh, true)

    if (vertices.length > numFaceCoordinates) {
        for (let i = numFaceCoordinates; i < vertices.length; i++) {
            points[i] = vertices[i]
        }
    }
    vertices = points
}

exports.updateIncomingMesh = function updateIncomingMesh(flattenedMesh) {
    var unflattenedMesh = []
    var coordinatePair = []
    var j = 0
    for (let i = 0; i<flattenedMesh.length; i++) {
        coordinatePair[j] = flattenedMesh[i]
        j++;
        if (j == 3) {
            j = 0;
            unflattenedMesh.push(coordinatePair)
            coordinatePair = []
        }
    }

    let points = []
    for (let i = 0; i < numFaceCoordinates; i++) {
        points[i] = vertices[i]
    }
    vertices = points
    vertices.push(...translateMesh(unflattenedMesh, false))
}

exports.render = function render(){
    if (!glInitialized) {
        startWebGL();
    }
    drawObjects();
}

/**********************************************************************/
/**********************************************************************/
/***********************INTERNAL FUNCTIONS*****************************/
/**********************************************************************/
/**********************************************************************/
function populateColorsWithColor(color) {
    for (var i = 0; i < numFaceVertices; i++) {
        colors.push(...color)
    }
}

function startWebGL(){
    canvas = document.getElementById(canvasName);
    gl = canvas.getContext('experimental-webgl');
    populateColorsWithColor(blueColor);
    populateColorsWithColor(pinkColor);

    // vertex shader source code
    var vertCode =
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
    var fragCode =
        'precision mediump float; ' +
        'varying vec4 outColor; ' +

        'void main(void) { ' +
        'gl_FragColor = outColor; ' +
        '}';

    var vertShader = gl.createShader(gl.VERTEX_SHADER); // Create a vertex shader object
    gl.shaderSource(vertShader, vertCode); // Attach vertex shader source code
    gl.compileShader(vertShader);// Compile the vertex shader

    // Check for any compilation error
    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(vertShader));
        return null;
    }

    var fragShader = gl.createShader(gl.FRAGMENT_SHADER);// Create fragment shader object
    gl.shaderSource(fragShader, fragCode); // Attach fragment shader source code
    gl.compileShader(fragShader); // Compile the fragmentt shader

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(fragShader));
        return null;
    }

    shaderProgram = gl.createProgram(); // Shader program object to store the combined shader program
    gl.attachShader(shaderProgram, vertShader);  // Attach a vertex shader
    gl.attachShader(shaderProgram, fragShader);  // Attach a fragment shader
    gl.linkProgram(shaderProgram); // Link both programs
    gl.useProgram(shaderProgram);
    glInitialized = true
}

function getCoordinateDivisors(scaledMesh) {
    var divisors = {maxX: -10000000, maxY: -10000000, maxZ:-10000000,
        minX: 10000000, minY: 10000000, minZ: 10000000,
        rangeX: 0, rangeY:0, rangeZ: 0}

    for (let i = 0; i < numFaceVertices; i++) {
        let x = scaledMesh[i][0]
        let y = scaledMesh[i][1]
        let z = scaledMesh[i][2]
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

//TODO: Understand why points need to be negated to avoid inverting the mesh
//      Understand why 0.5 needs to be subtracted from each dimension to center it
//      Remove uneeded shader Code
//      Research best way to send new objects down to the vertex buffer
function drawObjects(){
    //For EVERY attribute
    //create buffer, bind buffer, buffer data, vertAttribPointer(), enableVertAttribPointer()
    let vertex_buffer = gl.createBuffer(); // Create an empty buffer object to store the vertex buffer
    let coord = gl.getAttribLocation(shaderProgram, "a_Position"); // Get the attribute location
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); //Bind appropriate array buffer to it
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);// Pass the vertex data to the buffer
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
    gl.drawArrays(gl.POINTS, 0, vertices.length/3); // execute the vertex/fragment shader on the bounded buffer, using the
    // using the shaders compiled/linked and attached to gpuProgram
}

function translateMesh(scaledMesh, isLeft) {
    var meshPoints = []
    let divisors = getCoordinateDivisors(scaledMesh);

    var biggestRange = Math.max(divisors.rangeX, divisors.rangeY, divisors.rangeZ)
    var leftAdjuster = isLeft ? -0.1 : 0.9

    for (var i = 0; i < numFaceVertices; i++) {
        var pointsRow = [-(scaledMesh[i][0] - divisors.minX) / biggestRange + leftAdjuster,
            -(scaledMesh[i][1] - divisors.minY) / biggestRange + 0.5,
            -(scaledMesh[i][2] - divisors.minZ) / biggestRange]
        meshPoints.push(...pointsRow)
    }
    return meshPoints
}

