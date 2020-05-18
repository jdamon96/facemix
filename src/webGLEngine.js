//Copyright Placeholder
/* This script is responsible for interfacing with the WebGL pipeline to render meshes*/
"use strict"

//These should be defined in meshHandler but I'm getting "cannot access before initialization" errors when I try to
//import them

const canvasName = "canvas"
const canvas = document.getElementById(canvasName);
const numFacePoints = 468

export let WebGLEngine = {
    blueColor: [0.678, 0.847, .90],
    pinkColor: [1, .752, .796],
    numFaceCoordinates: (numFacePoints * 3),
    delta: 0.0,   //WebGL Refresh Rate
    shaderProgram: null,
    unscaledVertices: [],
    colors: [],   //Corresponding colors of each point being displayed
    gl: null,
    isGlInitialized: false,
    buttonOffsets: {'x': -0.5, 'y': 0.5, 'z': 1}, //Scalars to move the rendering based on key position
    buttonDelta: 0.1, //Amount a key press moves you within the canvas coordinate system
    buttonBounds: {x: {max: 1.0, min: -1.0}, y:{max: 1.0, min:-1.0}, z:{max:1.5, min:0.3}},

    getPersonalMeshForTransit: function() {
        let peerTransitMesh = []
        for (let i = 0; i < WebGLEngine.numFaceCoordinates; i++) {
            if (i % 3 == 0) { //x coordinate
                peerTransitMesh[i] = -WebGLEngine.unscaledVertices[i]
            } else {
                peerTransitMesh[i] = WebGLEngine.unscaledVertices[i]
            }
        }
        return peerTransitMesh
    },

    updatePersonalMesh: function(rawFacemesh) {
        const flattenedMesh = WebGLEngine.flattenMesh(rawFacemesh);
        const translatedMesh = WebGLEngine.translateMesh(flattenedMesh);
        const updatedVertices = WebGLEngine.truncateMesh(translatedMesh);

        if (WebGLEngine.unscaledVertices.length > WebGLEngine.numFaceCoordinates) {
            for (let i = WebGLEngine.numFaceCoordinates; i < WebGLEngine.unscaledVertices.length; i++) {
                updatedVertices[i] = WebGLEngine.unscaledVertices[i]
            }
        }
        WebGLEngine.unscaledVertices = updatedVertices
    },

    updatePeerMesh: function(transitMesh) {
        let updatedVertices = []
        for (let i = 0; i < WebGLEngine.numFaceCoordinates; i++) {
            updatedVertices[i] = WebGLEngine.unscaledVertices[i]
        }
        updatedVertices.push(...transitMesh)
        WebGLEngine.unscaledVertices = updatedVertices
    },

    render: function(){
        if (!WebGLEngine.isGlInitialized) {
            WebGLEngine.startWebGL();
        }
        const renderVertices = WebGLEngine.scaleMeshForLocalCanvas(WebGLEngine.unscaledVertices);

        WebGLEngine.drawObjects(renderVertices);
    },

    graphicsResizeOccurred: function(){
        if (!WebGLEngine.isGlInitialized) {
            WebGLEngine.startWebGL();
        }
        WebGLEngine.gl.viewport(0, 0, WebGLEngine.gl.canvas.width, WebGLEngine.gl.canvas.height);
    },

    updateOffset: function(dimension, isPositive) {
        let effectiveDelta = WebGLEngine.buttonDelta;
        if (!isPositive) {
            effectiveDelta = -effectiveDelta;
        }
        const min = WebGLEngine.buttonBounds[dimension]["min"]
        const max = WebGLEngine.buttonBounds[dimension]["max"]
        const result = WebGLEngine.buttonOffsets[dimension] + effectiveDelta

        if (result <= max && result >= min) {
            WebGLEngine.buttonOffsets[dimension] = result
        }
    },

    /************************************
             Graphics Pipeline
     ************************************/

    startWebGL: function(){
        let gl = canvas.getContext('experimental-webgl');
        WebGLEngine.populateColorsWithColor(WebGLEngine.blueColor);
        WebGLEngine.populateColorsWithColor(WebGLEngine.pinkColor);

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
            'gl_PointSize = 3.0;' +

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

        WebGLEngine.shaderProgram = gl.createProgram(); // Shader program object to store the combined shader program
        gl.attachShader(WebGLEngine.shaderProgram, vertShader);  // Attach a vertex shader
        gl.attachShader(WebGLEngine.shaderProgram, fragShader);  // Attach a fragment shader
        gl.linkProgram(WebGLEngine.shaderProgram); // Link both programs
        gl.useProgram(WebGLEngine.shaderProgram);
        WebGLEngine.isGlInitialized = true
        WebGLEngine.gl = gl //TODO: is this list needed
    },

    populateColorsWithColor: function(color) {
        for (let i = 0; i < numFacePoints; i++) {
            WebGLEngine.colors.push(...color)
        }
    },

    drawObjects: function (renderVertices){
        let gl = WebGLEngine.gl
        //For EVERY attribute
        //create buffer, bind buffer, buffer data, vertAttribPointer(), enableVertAttribPointer()
        let vertex_buffer = gl.createBuffer(); // Create an empty buffer object to store the vertex buffer
        let coord = gl.getAttribLocation(WebGLEngine.shaderProgram, "a_Position"); // Get the attribute location
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer); //Bind appropriate array buffer to it
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderVertices), gl.STATIC_DRAW);// Pass the vertex data to the buffer
        gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0); // Point an attribute to the currently bound VBO
        gl.enableVertexAttribArray(coord); // Enable the attribute

        let color_buffer = gl.createBuffer();
        let color = gl.getAttribLocation(WebGLEngine.shaderProgram, "a_Color");
        gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(WebGLEngine.colors), gl. STATIC_DRAW);
        gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(color);

        gl.clearColor(1.0, 1.0, 1.0, 1.0);     // Clear the canvas
        gl.enable(gl.DEPTH_TEST);              // Enable the depth test
        gl.clear(gl.COLOR_BUFFER_BIT);         // Clear the color buffer bit

        gl.useProgram(WebGLEngine.shaderProgram);          // Use the program I created/compiled and Linked
        gl.uniform1f(gl.getUniformLocation(WebGLEngine.shaderProgram, 'delta_x'), WebGLEngine.delta); // stores value of delta into delta_x on GPU

        gl.drawArrays(gl.POINTS, 0, renderVertices.length/3); // execute the vertex/fragment shader on the bounded buffer, using the shaders and programs linked and compiled
    },


    /************************************
        Mesh Manipulation Functions
     ************************************/

    getCoordinateDivisors: function(scaledMesh) {
        let divisors = {maxX: -10000000, maxY: -10000000, maxZ:-10000000,
            minX: 10000000, minY: 10000000, minZ: 10000000,
            rangeX: 0, rangeY:0, rangeZ: 0}

        for (let i = 0; i < WebGLEngine.numFaceCoordinates; i+=3) {
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
    },

    translateMesh: function(unscaledMesh) {
        let meshPoints = []
        let divisors = WebGLEngine.getCoordinateDivisors(unscaledMesh);

        const biggestRange = Math.max(divisors.rangeX, divisors.rangeY, divisors.rangeZ)

        for (let i = 0; i < WebGLEngine.numFaceCoordinates; i += 3) {
            let pointsRow = [
                // All mesh points flipped to negative because for some reason the mesh comes inverted.
                // The demo handles this by making the canvas coordinate system also inverted. See CanvasEngine setup
                -((unscaledMesh[i] - divisors.minX) * WebGLEngine.buttonOffsets['z']) / biggestRange + WebGLEngine.buttonOffsets['x'],
                -((unscaledMesh[i+1] - divisors.minY) * WebGLEngine.buttonOffsets['z']) / biggestRange + WebGLEngine.buttonOffsets['y'],
                -(unscaledMesh[i+2] - divisors.minZ) / biggestRange
            ]
            meshPoints.push(...pointsRow)
        }
        return meshPoints
    },

    //Expects a flat mesh
    scaleMeshForLocalCanvas: function(unscaledMesh) {
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
}