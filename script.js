/* =========================================================
   SCHOOL UNIFORM AI - PROTOTYPE
   Corrected script.js
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let poseLandmarker = null;

let video = document.getElementById("camera");
let canvas = document.getElementById("poseCanvas");
let ctx = canvas.getContext("2d");

let stream = null;

let latestLandmarks = null;

let studentData = {};

let personReady = false;

let previousTime = -1;

let aiLoading = false;


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function hideAllSections() {

    const sections = [
        "intro",
        "studentForm",
        "cameraSection",
        "processing",
        "results"
    ];

    sections.forEach(function(id) {

        const section =
            document.getElementById(id);

        if (section) {
            section.classList.add("hidden");
        }

    });
}


/* =========================================================
   START MEASUREMENT
========================================================= */

window.showStudentForm = function() {

    hideAllSections();

    const form =
        document.getElementById("studentForm");

    if (form) {
        form.classList.remove("hidden");
    }

};


/* =========================================================
   START CAMERA
========================================================= */

window.startCamera = async function() {

    const name =
        document
            .getElementById("studentName")
            .value
            .trim();


    const id =
        document
            .getElementById("studentId")
            .value
            .trim();


    const studentClass =
        document
            .getElementById("studentClass")
            .value
            .trim();


    const height =
        parseFloat(
            document
                .getElementById("studentHeight")
                .value
        );


    /* Check details */

    if (
        !name ||
        !id ||
        !studentClass ||
        !height
    ) {

        alert(
            "Please fill all student details."
        );

        return;
    }


    /* Check height */

    if (
        height < 80 ||
        height > 220
    ) {

        alert(
            "Please enter a realistic height between 80 and 220 cm."
        );

        return;
    }


    /* Save student */

    studentData = {

        name: name,

        id: id,

        className: studentClass,

        height: height

    };


    /* Show camera page */

    hideAllSections();

    document
        .getElementById("cameraSection")
        .classList
        .remove("hidden");


    setStatus(
        "yellow",
        "Opening camera..."
    );


    try {

        /* First open camera */

        await openCamera();


        setStatus(
            "yellow",
            "Camera working ✓ Loading AI..."
        );


        /*
           Only NOW load MediaPipe.
           This means a MediaPipe error cannot
           stop the Start Measurement button.
        */

        await loadMediaPipe();


        setStatus(
            "yellow",
            "AI loaded ✓ Detecting body..."
        );


        document
            .getElementById("instruction")
            .innerText =
            "Stand inside the body outline.";


        requestAnimationFrame(
            detectPose
        );


    }

    catch (error) {

        console.error(
            "AI/CAMERA ERROR:",
            error
        );


        stopCamera();


        setStatus(
            "red",
            "AI could not start."
        );


        document
            .getElementById("instruction")
            .innerText =
            "AI body detection could not start.";


        alert(
            "AI body detection could not load.\n\n" +
            "Error: " +
            error.message
        );

    }

};


/* =========================================================
   OPEN CAMERA
========================================================= */

async function openCamera() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Camera API is not supported by this browser."
        );

    }


    try {

        stream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: "user",

                        width: {
                            ideal: 720
                        },

                        height: {
                            ideal: 960
                        }

                    },

                    audio: false

                });

    }

    catch (error) {

        throw new Error(
            "Camera permission was denied or the camera is unavailable."
        );

    }


    video.srcObject = stream;

    video.autoplay = true;

    video.playsInline = true;

    video.muted = true;


    await video.play();


    /*
       Wait until camera has dimensions.
    */

    await waitForVideo();


    canvas.width =
        video.videoWidth || 720;


    canvas.height =
        video.videoHeight || 960;

}


/* =========================================================
   WAIT FOR VIDEO
========================================================= */

function waitForVideo() {

    return new Promise(function(resolve) {

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0
        ) {

            resolve();

            return;

        }


        video.onloadedmetadata =
            function() {

                resolve();

            };

    });

}


/* =========================================================
   LOAD MEDIAPIPE
========================================================= */

async function loadMediaPipe() {

    if (poseLandmarker) {

        return;

    }


    if (aiLoading) {

        return;

    }


    aiLoading = true;


    try {

        /*
           Load MediaPipe dynamically.

           We use unpkg instead of the previous
           jsDelivr module.
        */

        const module =
            await import(
                "https://unpkg.com/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
            );


        const FilesetResolver =
            module.FilesetResolver;


        const PoseLandmarker =
            module.PoseLandmarker;


        if (
            !FilesetResolver ||
            !PoseLandmarker
        ) {

            throw new Error(
                "MediaPipe loaded, but PoseLandmarker was not found."
            );

        }


        /*
           Load MediaPipe WASM engine.
        */

        const vision =
            await FilesetResolver
                .forVisionTasks(

                    "https://unpkg.com/@mediapipe/tasks-vision@0.10.22/wasm"

                );


        /*
           Load body model.
        */

        poseLandmarker =
            await PoseLandmarker
                .createFromOptions(

                    vision,

                    {

                        baseOptions: {

                            modelAssetPath:
                                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

                            /*
                               CPU is more compatible
                               than GPU for this prototype.
                            */

                            delegate: "CPU"

                        },


                        runningMode: "VIDEO",


                        numPoses: 1,


                        minPoseDetectionConfidence: 0.5,


                        minPosePresenceConfidence: 0.5,


                        minTrackingConfidence: 0.5

                    }

                );


    }

    catch (error) {

        console.error(
            "MediaPipe loading error:",
            error
        );


        throw new Error(
            "MediaPipe could not be loaded.\n" +
            error.message
        );

    }

    finally {

        aiLoading = false;

    }

}


/* =========================================================
   BODY DETECTION
========================================================= */

async function detectPose(time) {

    /*
       If AI isn't ready, keep waiting.
    */

    if (
        !poseLandmarker ||
        video.readyState < 2
    ) {

        requestAnimationFrame(
            detectPose
        );

        return;

    }


    /*
       Avoid duplicate timestamps.
    */

    if (
        time === previousTime
    ) {

        requestAnimationFrame(
            detectPose
        );

        return;

    }


    previousTime = time;


    try {

        const result =
            poseLandmarker
                .detectForVideo(
                    video,
                    time
                );


        if (
            result.landmarks &&
            result.landmarks.length > 0
        ) {

            latestLandmarks =
                result.landmarks[0];


            drawLandmarks(
                latestLandmarks
            );


            checkBodyPosition(
                latestLandmarks
            );

        }

        else {

            latestLandmarks = null;

            personReady = false;


            disableCapture();


            setStatus(
                "red",
                "No person detected. Step into the outline."
            );

        }

    }

    catch (error) {

        console.error(
            "Pose detection error:",
            error
        );

    }


    requestAnimationFrame(
        detectPose
    );

}


/* =========================================================
   DRAW BODY LANDMARKS
========================================================= */

function drawLandmarks(
    landmarks
) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle =
        "#00ff88";


    landmarks.forEach(
        function(point) {

            const x =
                point.x *
                canvas.width;


            const y =
                point.y *
                canvas.height;


            ctx.beginPath();


            ctx.arc(
                x,
                y,
                5,
                0,
                Math.PI * 2
            );


            ctx.fill();

        }
    );

}


/* =========================================================
   CHECK BODY POSITION
========================================================= */

function checkBodyPosition(
    landmarks
) {

    const nose =
        landmarks[0];


    const leftShoulder =
        landmarks[11];


    const rightShoulder =
        landmarks[12];


    const leftHip =
        landmarks[23];


    const rightHip =
        landmarks[24];


    const leftAnkle =
        landmarks[27];


    const rightAnkle =
        landmarks[28];


    /*
       Make sure important body points
       are available.
    */

    if (
        !nose ||
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip ||
        !leftAnkle ||
        !rightAnkle
    ) {

        personReady = false;

        disableCapture();


        setStatus(
            "red",
            "Make sure your whole body is visible."
        );


        return;

    }


    /*
       Calculate body height
       in normalized camera coordinates.
    */

    const bodyTop =
        nose.y;


    const bodyBottom =
        Math.max(
            leftAnkle.y,
            rightAnkle.y
        );


    const bodyHeight =
        bodyBottom -
        bodyTop;


    /*
       Too far away.
    */

    if (
        bodyHeight < 0.65
    ) {

        personReady = false;

        disableCapture();


        setStatus(
            "yellow",
            "Move closer to the camera."
        );


        return;

    }


    /*
       Too close.
    */

    if (
        bodyHeight > 0.95
    ) {

        personReady = false;

        disableCapture();


        setStatus(
            "yellow",
            "Move slightly away."
        );


        return;

    }


    /*
       Check shoulder level.
    */

    const shoulderDifference =
        Math.abs(
            leftShoulder.y -
            rightShoulder.y
        );


    if (
        shoulderDifference > 0.08
    ) {

        personReady = false;

        disableCapture();


        setStatus(
            "yellow",
            "Please stand straight."
        );


        return;

    }


    /*
       Student is ready.
    */

    personReady = true;


    setStatus(
        "green",
        "Perfect position! Hold still."
    );


    const button =
        document
            .getElementById("captureButton");


    if (button) {

        button.disabled = false;

    }

}


/* =========================================================
   DISABLE CAPTURE
========================================================= */

function disableCapture() {

    const button =
        document
            .getElementById("captureButton");


    if (button) {

        button.disabled = true;

    }

}


/* =========================================================
   STATUS MESSAGE
========================================================= */

function setStatus(
    color,
    message
) {

    const light =
        document
            .getElementById("statusLight");


    const text =
        document
            .getElementById("statusText");


    if (
        !light ||
        !text
    ) {

        return;

    }


    text.innerText =
        message;


    if (
        color === "green"
    ) {

        light.style.background =
            "#20bf6b";

    }

    else if (
        color === "yellow"
    ) {

        light.style.background =
            "#f1b900";

    }

    else {

        light.style.background =
            "#eb3b5a";

    }

}


/* =========================================================
   CAPTURE PHOTO
========================================================= */

window.capturePhoto =
function() {

    if (
        !latestLandmarks ||
        !personReady
    ) {

        alert(
            "Please stand correctly inside the outline first."
        );

        return;

    }


    /*
       Save the landmarks before
       stopping the camera.
    */

    const savedLandmarks =
        latestLandmarks;


    stopCamera();


    hideAllSections();


    document
        .getElementById("processing")
        .classList
        .remove("hidden");


    setTimeout(
        function() {

            calculateMeasurements(
                savedLandmarks
            );

        },
        1200
    );

};


/* =========================================================
   STOP CAMERA
========================================================= */

function stopCamera() {

    if (stream) {

        stream
            .getTracks()
            .forEach(
                function(track) {

                    track.stop();

                }
            );


        stream = null;

    }

}


/* =========================================================
   MEASUREMENT CALCULATION
========================================================= */

function calculateMeasurements(
    landmarks
) {

    const knownHeight =
        studentData.height;


    /*
       Body landmarks.
    */

    const nose =
        landmarks[0];


    const leftShoulder =
        landmarks[11];


    const rightShoulder =
        landmarks[12];


    const leftElbow =
        landmarks[13];


    const rightElbow =
        landmarks[14];


    const leftWrist =
        landmarks[15];


    const rightWrist =
        landmarks[16];


    const leftHip =
        landmarks[23];


    const rightHip =
        landmarks[24];


    const leftKnee =
        landmarks[25];


    const rightKnee =
        landmarks[26];


    const leftAnkle =
        landmarks[27];


    const rightAnkle =
        landmarks[28];


    /*
       Calculate visible body height.
    */

    const top =
        nose.y;


    const bottom =
        Math.max(
            leftAnkle.y,
            rightAnkle.y
        );


    const pixelHeight =
        bottom -
        top;


    /*
       Distance between two landmarks.
    */

    function distance(
        a,
        b
    ) {

        const dx =
            a.x -
            b.x;


        const dy =
            a.y -
            b.y;


        return Math.sqrt(
            dx * dx +
            dy * dy
        );

    }


    /*
       Convert normalized distance
       into approximate centimeters.
    */

    function cmDistance(
        a,
        b
    ) {

        return (
            distance(a, b) /
            pixelHeight
        ) *
        knownHeight;

    }


    /*
       Shoulder width.
    */

    const shoulder =
        cmDistance(
            leftShoulder,
            rightShoulder
        );


    /*
       Left arm.
    */

    const leftArm =
        cmDistance(
            leftShoulder,
            leftElbow
        ) +

        cmDistance(
            leftElbow,
            leftWrist
        );


    /*
       Right arm.
    */

    const rightArm =
        cmDistance(
            rightShoulder,
            rightElbow
        ) +

        cmDistance(
            rightElbow,
            rightWrist
        );


    /*
       Average arm length.
    */

    const arm =
        (
            leftArm +
            rightArm
        ) / 2;


    /*
       Left leg.
    */

    const leftLeg =
        cmDistance(
            leftHip,
            leftKnee
        ) +

        cmDistance(
            leftKnee,
            leftAnkle
        );


    /*
       Right leg.
    */

    const rightLeg =
        cmDistance(
            rightHip,
            rightKnee
        ) +

        cmDistance(
            rightKnee,
            rightAnkle
        );


    /*
       Approximate inseam.
    */

    const inseam =
        (
            (leftLeg + rightLeg) /
            2
        ) * 0.88;


    /*
       IMPORTANT:

       Chest and waist are only rough
       prototype estimates from shoulder
       width.

       A future version should use
       calibrated 3D/body-scan technology.
    */

    const chest =
        shoulder * 2.15;


    const waist =
        shoulder * 1.75;


    /*
       Display height.
    */

    document
        .getElementById("heightResult")
        .innerText =
        round(
            knownHeight
        ) +
        " cm";


    /*
       Display shoulder.
    */

    document
        .getElementById("shoulderResult")
        .innerText =
        round(
            shoulder
        ) +
        " cm";


    /*
       Display arm.
    */

    document
        .getElementById("armResult")
        .innerText =
        round(
            arm
        ) +
        " cm";


    /*
       Display inseam.
    */

    document
        .getElementById("inseamResult")
        .innerText =
        round(
            inseam
        ) +
        " cm";


    /*
       Display chest.
    */

    document
        .getElementById("chestResult")
        .innerText =
        round(
            chest
        ) +
        " cm";


    /*
       Display waist.
    */

    document
        .getElementById("waistResult")
        .innerText =
        round(
            waist
        ) +
        " cm";


    /*
       Uniform size.
    */

    const uniformSize =
        calculateUniformSize(
            chest,
            waist
        );


    document
        .getElementById("uniformSize")
        .innerText =
        uniformSize;


    /*
       Student name and class.
    */

    document
        .getElementById("resultStudent")
        .innerText =
        studentData.name +
        " • " +
        studentData.className;


    /*
       Show results.
    */

    hideAllSections();


    document
        .getElementById("results")
        .classList
        .remove("hidden");

}


/* =========================================================
   UNIFORM SIZE
========================================================= */

function calculateUniformSize(
    chest,
    waist
) {

    /*
       Demo sizing chart.

       This can later be replaced with
       each school's actual uniform chart.
    */

    if (
        chest < 70
    ) {

        return "28";

    }


    if (
        chest < 76
    ) {

        return "30";

    }


    if (
        chest < 82
    ) {

        return "32";

    }


    if (
        chest < 88
    ) {

        return "34";

    }


    if (
        chest < 94
    ) {

        return "36";

    }


    return "38+";

}


/* =========================================================
   ROUND NUMBER
========================================================= */

function round(
    number
) {

    return Math.round(
        number * 10
    ) / 10;

}
