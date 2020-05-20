const canvasName = "canvas"
const canvas = document.getElementById(canvasName);
const pageContent = document.getElementById('page-content');

const numFacePoints = 468
const decimalPrecision = 2 // Number of places to round decimals in model output to

export let CanvasEngine = {
    canvasContext: null,
    isCanvasInitialized: null,
    numFaceCoordinates: numFacePoints * 2,
    unscaledVertices: [],
    buttonOffsets: {'x': -0.5, 'y': 0.5, 'z': 1}, // Scalars to move the rendering based on key position
    buttonDelta: 50.0, // Amount a key press moves you within the canvas coordinate system (for wasd)
    zButtonDelta: 0.1, // Amount a key press scales your image (for 'i' and 'k')
    buttonBounds: {x: {max: 1.0, min: -1.0}, y:{max: 1.0, min:-1.0}, z:{max:1.5, min:0.3}},
    personalColor: '#32EEDB',
    peerColor: '#FF1493',


    getPersonalMeshForTransit: function() {
        const midLine = canvas.width / 2
        let peerTransitMesh = []
        for (let i = 0; i < CanvasEngine.numFaceCoordinates; i += 2) {
            peerTransitMesh[i] = (midLine - (CanvasEngine.unscaledVertices[i] - midLine)) / canvas.width
            peerTransitMesh[i+1] = CanvasEngine.unscaledVertices[i+1] / canvas.height
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
        const updatedVertices = CanvasEngine.truncateMesh(translatedMesh);

        if (CanvasEngine.unscaledVertices.length > CanvasEngine.numFaceCoordinates) {
            for (let i = CanvasEngine.numFaceCoordinates; i < CanvasEngine.unscaledVertices.length; i++) {
                updatedVertices[i] = CanvasEngine.unscaledVertices[i]
            }
        }
        CanvasEngine.unscaledVertices = updatedVertices
    },

    updatePeerMesh: function(transitMesh) {
        let updatedVertices = []
        for (let i = 0; i < CanvasEngine.numFaceCoordinates; i++) {
            updatedVertices[i] = CanvasEngine.unscaledVertices[i]
        }
        for (let j = 0; j < transitMesh.length; j+=2) {
            updatedVertices.push(transitMesh[j] * canvas.width)
            updatedVertices.push(transitMesh[j + 1] * canvas.height)
        }
        CanvasEngine.unscaledVertices = updatedVertices
    },

    setPersonalColor: function(color) {
        CanvasEngine.personalColor = color;
    },

    setPeerColor: function(color) {
        CanvasEngine.peerColor = color;
    },

    clearPersonalMesh: function() {
        CanvasEngine.unscaledVertices = [];
    },

    clearPeerMesh: function() {
        CanvasEngine.unscaledVertices.length = CanvasEngine.numFaceCoordinates;
    },


    render: function() {
        if (!CanvasEngine.isCanvasInitialized) {
            CanvasEngine.setupCanvas()
        }
       // const renderVertices = CanvasEngine.scaleMeshForLocalCanvas(CanvasEngine.unscaledVertices);
       // CanvasEngine.drawObjects(renderVertices)
        CanvasEngine.drawObjects(CanvasEngine.unscaledVertices)
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
        CanvasEngine.setBounds();

        CanvasEngine.canvasContext.translate(canvas.width, 0);
        CanvasEngine.canvasContext.scale(-1, 1);  //Inverses the coordinate system so greatest val is leftmost. Makes handling an inverted mesh intuitive
    },

    updateOffset: function(dimension, isPositive) {
        let effectiveDelta = dimension == "z" ? CanvasEngine.zButtonDelta : CanvasEngine.buttonDelta
        if (!isPositive) {
            effectiveDelta = -effectiveDelta;
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
        CanvasEngine.setBounds();

        CanvasEngine.canvasContext.translate(canvas.width, 0);
        CanvasEngine.canvasContext.scale(-1, 1); //Inverses the coordinate system so greatest val is leftmost. Makes handling an inverted mesh intuitive
        CanvasEngine.canvasContext.lineWidth = 0.5;

        CanvasEngine.buttonOffsets['x'] =  0;

        CanvasEngine.isCanvasInitialized = true
    },
    
    setBounds: function() {
        canvas.width = pageContent.offsetWidth;
        canvas.height = pageContent.offsetHeight;

        canvas.style.width = pageContent.offsetWidth+'px';
        canvas.style.height = pageContent.offsetHeight+'px';

        CanvasEngine.buttonBounds.x.max = canvas.width / 2
        CanvasEngine.buttonBounds.x.min = - (canvas.width) / 2
        CanvasEngine.buttonBounds.y.max = canvas.height / 2
        CanvasEngine.buttonBounds.y.min = - canvas.height / 2
    },

    /**************************************
            Mesh Manipulation Functions
     **************************************/

    translateMesh: function(unscaledMesh) {
        let translatedMesh = []
        for (let i = 0; i < unscaledMesh.length; i += 2) {
            let pointsRow = [
                (unscaledMesh[i] * CanvasEngine.buttonOffsets['z'] - CanvasEngine.buttonOffsets['x']),
                (unscaledMesh[i+1] * CanvasEngine.buttonOffsets['z'] - CanvasEngine.buttonOffsets['y'])
            ]
            translatedMesh.push(...pointsRow)
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

    // Expects mesh that is completely ready for render other than local canvas adjustments
    scaleMeshForLocalCanvas: function(unscaledMesh) {
        const scaledMesh = []
        const xScalar = canvas.width / canvas.height;
        for (let i = 0; i < unscaledMesh.length; i++) {
            if ((i % 2) === 0) {
                scaledMesh.push(unscaledMesh[i] * xScalar);
            } else {
                scaledMesh.push(unscaledMesh[i]);
            }
        }
        return scaledMesh;
    }
}