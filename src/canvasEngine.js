const canvasName = "canvas"
const canvas = document.getElementById(canvasName);
const pageContent = document.getElementById('page-content');

const numFacePoints = 468
const decimalPrecision = 2 // Number of places to round decimals in model output to

export let CanvasEngine = {
    canvasContext: null,
    isCanvasInitialized: null,
    numFaceCoordinates: numFacePoints * 2,
    vertices: [],
    buttonOffsets: {'x': 0.75, 'y': 0.5, 'z': 1}, // Scalars to move the rendering based on key position
    xOffset: 300, // The facemesh comes back from the model with 300 as the center x point and 200 as the center y
    yOffset: 200,
    buttonDelta: 0.1, // Percent of the screen you are moving across for 'wasd' and amount you scale your image for 'i' and 'k'
    buttonBounds: {x: {max: 1.0, min: 0}, y:{max: 1.0, min: 0}, z:{max:1.5, min:0.3}},
    needsOffsetUpdate: false,
    personalColor: '#32EEDB',
    peerColor: '#FF1493',


    getPersonalMeshForTransit: function() {
        const minDimension = canvas.width < canvas.height ? canvas.width : canvas.height;
        const midLine = canvas.width / 2
        let peerTransitMesh = []
        for (let i = 0; i < CanvasEngine.numFaceCoordinates; i += 2) {
            peerTransitMesh[i] = (midLine - (CanvasEngine.vertices[i] - midLine)) / minDimension
            peerTransitMesh[i+1] = CanvasEngine.vertices[i+1] / minDimension
        }
        return CanvasEngine.truncateMesh(peerTransitMesh);
    },

    updatePersonalMesh: function(rawFacemesh) {
        if (!CanvasEngine.isCanvasInitialized) {
            CanvasEngine.setupCanvas()
        }
        const flattenedMesh = CanvasEngine.flattenMesh(rawFacemesh);
        const twoDimensionalMesh = CanvasEngine.removeZCoordinates(flattenedMesh);
        const translatedMesh = CanvasEngine.translateMesh(twoDimensionalMesh);

        if (CanvasEngine.vertices.length > CanvasEngine.numFaceCoordinates) {
            for (let i = CanvasEngine.numFaceCoordinates; i < CanvasEngine.vertices.length; i++) {
                translatedMesh[i] = CanvasEngine.vertices[i]
            }
        }
        CanvasEngine.vertices = translatedMesh
    },

    updatePeerMesh: function(transitMesh) {
        let peerMeshForRender = []
        const minDimension = canvas.width < canvas.height ? canvas.width : canvas.height

        for (let j = 0; j < transitMesh.length; j+=2) {
            peerMeshForRender.push(transitMesh[j] * minDimension)
            peerMeshForRender.push(transitMesh[j + 1] * minDimension)
        }
        peerMeshForRender = CanvasEngine.boundsCheckAndCorrectMesh(peerMeshForRender)
        CanvasEngine.vertices.length = CanvasEngine.numFaceCoordinates
        CanvasEngine.vertices.push(...peerMeshForRender)
    },

    setPersonalColor: function(color) {
        CanvasEngine.personalColor = color;
    },

    setPeerColor: function(color) {
        CanvasEngine.peerColor = color;
    },

    clearPersonalMesh: function() {
        CanvasEngine.vertices = [];
    },

    clearPeerMesh: function() {
        CanvasEngine.vertices.length = CanvasEngine.numFaceCoordinates;
    },

    render: function() {
        if (!CanvasEngine.isCanvasInitialized) {
            CanvasEngine.setupCanvas()
        }
        CanvasEngine.drawObjects(CanvasEngine.vertices)
    },

    drawObjects: function(renderVertices) {
        CanvasEngine.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        CanvasEngine.canvasContext.fillStyle = CanvasEngine.personalColor;
        CanvasEngine.canvasContext.strokeStyle = CanvasEngine.personalColor;

        for (let i = 0; i < renderVertices.length; i+=2) {
            const x = renderVertices[i];
            const y = renderVertices[i+1];

            CanvasEngine.canvasContext.beginPath();
            CanvasEngine.canvasContext.arc(x, y, 1 /* radius */, 0, 2 * Math.PI);
            CanvasEngine.canvasContext.fill();
            if (i == CanvasEngine.numFaceCoordinates) {
                CanvasEngine.canvasContext.fillStyle = CanvasEngine.peerColor;
                CanvasEngine.canvasContext.strokeStyle = CanvasEngine.peerColor;
            }
        }
    },

    graphicsResizeOccurred: function(){
        CanvasEngine.setCanvasBounds();

        CanvasEngine.canvasContext.translate(canvas.width, 0);
        CanvasEngine.canvasContext.scale(-1, 1);  //Inverses the coordinate system so greatest val is leftmost. Makes handling an inverted mesh intuitive
    },

    updateOffset: function(dimension, isPositive) {
        let effectiveDelta = CanvasEngine.buttonDelta
        if (!isPositive) {
             effectiveDelta = -effectiveDelta;
        }
        if (dimension != "z") {
            effectiveDelta = -effectiveDelta
        }
        const min = CanvasEngine.buttonBounds[dimension]["min"]
        const max = CanvasEngine.buttonBounds[dimension]["max"]
        const result = CanvasEngine.buttonOffsets[dimension] + effectiveDelta

        if (result <= max && result >= min) {
            CanvasEngine.buttonOffsets[dimension] = result
        }
    },

    setupCanvas: function() {
        console.log('Setting up canvas');
        CanvasEngine.canvasContext = canvas.getContext('2d');
        CanvasEngine.setCanvasBounds();

        CanvasEngine.canvasContext.translate(canvas.width, 0);
        CanvasEngine.canvasContext.scale(-1, 1); //Inverses the coordinate system so greatest val is leftmost. Makes handling an inverted mesh intuitive
        CanvasEngine.canvasContext.lineWidth = 0.5;

        CanvasEngine.isCanvasInitialized = true
    },
    
    setCanvasBounds: function() {
        canvas.width = pageContent.offsetWidth;
        canvas.height = pageContent.offsetHeight;

        canvas.style.width = pageContent.offsetWidth+'px';
        canvas.style.height = pageContent.offsetHeight+'px';
    },

    /**************************************
            Mesh Manipulation Functions
     **************************************/

    translateMesh: function(unscaledMesh) {
        let translatedMesh = []
        for (let i = 0; i < unscaledMesh.length; i += 2) {
            let pointsRow = [
                ((unscaledMesh[i] * CanvasEngine.buttonOffsets['z']) + (CanvasEngine.buttonOffsets.x * canvas.width) - CanvasEngine.xOffset),
                ((unscaledMesh[i+1] * CanvasEngine.buttonOffsets['z']) + (CanvasEngine.buttonOffsets.y * canvas.height) - CanvasEngine.yOffset)
            ]
            translatedMesh.push(...pointsRow)
        }
        return CanvasEngine.boundsCheckAndCorrectMesh(translatedMesh)
    },

    //If any of the points are off the screen, shift the mesh to instead be on the edge of that canvas "wall"
    boundsCheckAndCorrectMesh: function(translatedMesh) {
        let xMax = 0, yMax = 0;
        let xMin = Number.MAX_SAFE_INTEGER, yMin = Number.MAX_SAFE_INTEGER;

        //Calculate if outside of canvas and if it is set it at the exact edge of the canvas
        for (let i = 0; i < translatedMesh.length; i+=2) {
            if (translatedMesh[i] < xMin) {
                xMin = translatedMesh[i]
            }
            if (translatedMesh[i] > xMax) {
                xMax = translatedMesh[i]
            }
            if (translatedMesh[i+1] > yMax) {
                yMax = translatedMesh[i+1]
            }
            if (translatedMesh[i+1] < yMin) {
                yMin = translatedMesh[i+1]
            }
        }
        let xOffScreenCorrector = 0, yOffScreenCorrector = 0;

        const tooLeft = xMax > canvas.width
        const tooRight = xMin < 0
        const tooUp = yMin < 0
        const tooDown = yMax > canvas.height
        if (!(tooLeft && tooRight)) { //Only enter adjustments if you aren't off both sides of the screen
            if (tooLeft) {
                xOffScreenCorrector = canvas.width - xMax
            } else if (tooRight) {
                xOffScreenCorrector = 0 - xMin
            }
        }

        if (!(tooUp && tooDown)) {
            if (tooDown) {
                yOffScreenCorrector = canvas.height - yMax
            } else if (tooUp) {
                yOffScreenCorrector = 0 - yMin
            }
        }

        if (xOffScreenCorrector != 0 || yOffScreenCorrector != 0) {
            for (let i = 0; i < translatedMesh.length; i += 2) {
                translatedMesh[i] = translatedMesh[i] + xOffScreenCorrector
                translatedMesh[i+1] = translatedMesh[i+1] + yOffScreenCorrector
            }
        }
        return translatedMesh
    },

    removeZCoordinates: function(threeDimensionalMesh) {
        let twoDMesh = []
        for (let i = 0; i < threeDimensionalMesh.length; i+=3) {
            twoDMesh.push(threeDimensionalMesh[i])
            twoDMesh.push(threeDimensionalMesh[i+1])
        }
        return twoDMesh;
    },
}