let poseLandmarker = null;

let video = document.getElementById("camera");
let canvas = document.getElementById("poseCanvas");
let ctx = canvas.getContext("2d");

let stream = null;
let latestLandmarks = null;
let studentData = {};
let personReady = false;
let previousTime = -1;


/* --------------------------------------------------
   PAGE NAVIGATION
-------------------------------------------------- */

function hideAllSections() {

    document.getElementById("intro").classList.add("hidden");
    document.getElementById("studentForm").classList.add("hidden");
    document.getElementById("cameraSection").classList.add("hidden");
    document.getElementById("processing").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
}


window.showStudentForm = function () {

    hideAllSections();

    document.getElementById("studentForm").classList.remove("hidden");
};


/* --------------------------------------------------
   START CAMERA
-------------------------------------------------- */

window.startCamera = async function () {

    const name =
        document.getElementById("studentName").value.trim();

    const id =
        document.getElementById("studentId").value.trim();

    const studentClass =
        document.getElementById("studentClass").value.trim();

    const height =
        parseFloat(
            document.getElementById("studentHeight").value
        );


    if (!name || !id || !studentClass || !height) {

        alert("Please fill all student details.");

        return;
    }


    if (height < 80 || height > 220) {

        alert("Please enter a realistic height between 80 and 220 cm.");

        return;
    }


    studentData = {
        name: name,
        id: id,
        className: studentClass,
        height: height
    };


    hideAllSections();

    document
        .getElementById("cameraSection")
        .classList.remove("hidden");


    setStatus(
        "yellow",
        "Loading body detection..."
    );


    try {

        await setupPoseDetection();

        await openCamera();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to start the camera system. Please check your internet connection and camera permission."
        );

        hideAllSections();

        document
            .getElementById("studentForm")
            .classList.remove("hidden");
    }
};


/* --------------------------------------------------
   LOAD MEDIAPIPE
-------------------------------------------------- */

async function setupPoseDetection() {

    if (poseLandmarker) {
        return;
    }


    const {
        FilesetResolver,
        PoseLandmarker
    } =
        await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
        );


    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );


    poseLandmarker =
        await PoseLandmarker.createFromOptions(
            vision,
            {

                baseOptions: {

                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

                    delegate: "GPU"
                },

                runningMode: "VIDEO",

                numPoses: 1,

                minPoseDetectionConfidence: 0.5,

                minPosePresenceConfidence: 0.5,

                minTrackingConfidence: 0.5
            }
        );


    document.getElementById("instruction").innerText =
        "Stand inside the body outline.";
}


/* --------------------------------------------------
   OPEN CAMERA
-------------------------------------------------- */

async function openCamera() {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

        throw new Error(
            "Camera API not supported."
        );
    }


    stream =
        await navigator.mediaDevices.getUserMedia({

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


    video.srcObject = stream;

    await video.play();


    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;


    setStatus(
        "yellow",
        "Detecting your body..."
    );


    requestAnimationFrame(detectPose);
}


/* --------------------------------------------------
   BODY DETECTION
-------------------------------------------------- */

async function detectPose(time) {

    if (!poseLandmarker ||
        video.readyState < 2) {

        requestAnimationFrame(detectPose);

        return;
    }


    if (time !== previousTime) {

        previousTime = time;


        const result =
            poseLandmarker.detectForVideo(
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

        } else {

            setStatus(
                "red",
                "No person detected. Step into the outline."
            );

            personReady = false;

            document.getElementById(
                "captureButton"
            ).disabled = true;
        }
    }


    requestAnimationFrame(detectPose);
}


/* --------------------------------------------------
   DRAW LANDMARKS
-------------------------------------------------- */

function drawLandmarks(landmarks) {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.fillStyle = "#00ff88";


    landmarks.forEach(point => {

        const x =
            point.x * canvas.width;

        const y =
            point.y * canvas.height;


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();
    });
}


/* --------------------------------------------------
   POSITION CHECK
-------------------------------------------------- */

function checkBodyPosition(landmarks) {

    const nose = landmarks[0];

    const leftShoulder = landmarks[11];

    const rightShoulder = landmarks[12];

    const leftHip = landmarks[23];

    const rightHip = landmarks[24];

    const leftAnkle = landmarks[27];

    const rightAnkle = landmarks[28];


    if (
        !nose ||
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip ||
        !leftAnkle ||
        !rightAnkle
    ) {

        setStatus(
            "red",
            "Please make sure your whole body is visible."
        );

        personReady = false;

        disableCapture();

        return;
    }


    const bodyTop =
        nose.y;


    const bodyBottom =
        Math.max(
            leftAnkle.y,
            rightAnkle.y
        );


    const bodyHeight =
        bodyBottom - bodyTop;


    if (bodyHeight < 0.65) {

        setStatus(
            "yellow",
            "Move closer to the camera."
        );

        personReady = false;

        disableCapture();

        return;
    }


    if (bodyHeight > 0.95) {

        setStatus(
            "yellow",
            "Move slightly away."
        );

        personReady = false;

        disableCapture();

        return;
    }


    const shoulderDifference =
        Math.abs(
            leftShoulder.y -
            rightShoulder.y
        );


    if (shoulderDifference > 0.08) {

        setStatus(
            "yellow",
            "Please stand straight."
        );

        personReady = false;

        disableCapture();

        return;
    }


    setStatus(
        "green",
        "Perfect position! Hold still."
    );


    personReady = true;


    document.getElementById(
        "captureButton"
    ).disabled = false;
}


function disableCapture() {

    document.getElementById(
        "captureButton"
    ).disabled = true;
}


/* --------------------------------------------------
   STATUS
-------------------------------------------------- */

function setStatus(color, message) {

    const light =
        document.getElementById("statusLight");

    const text =
        document.getElementById("statusText");


    if (!light || !text) {
        return;
    }


    text.innerText = message;


    if (color === "green") {

        light.style.background = "#20bf6b";

    } else if (color === "yellow") {

        light.style.background = "#f1b900";

    } else {

        light.style.background = "#eb3b5a";
    }
}


/* --------------------------------------------------
   CAPTURE
-------------------------------------------------- */

window.capturePhoto = function () {

    if (!latestLandmarks || !personReady) {

        return;
    }


    stopCamera();


    hideAllSections();


    document
        .getElementById("processing")
        .classList.remove("hidden");


    setTimeout(() => {

        calculateMeasurements(
            latestLandmarks
        );

    }, 1800);
};


/* --------------------------------------------------
   STOP CAMERA
-------------------------------------------------- */

function stopCamera() {

    if (stream) {

        stream.getTracks().forEach(
            track => track.stop()
        );

        stream = null;
    }
}


/* --------------------------------------------------
   MEASUREMENTS
-------------------------------------------------- */

function calculateMeasurements(landmarks) {

    const knownHeight =
        studentData.height;


    const nose = landmarks[0];

    const leftShoulder = landmarks[11];

    const rightShoulder = landmarks[12];

    const leftElbow = landmarks[13];

    const rightElbow = landmarks[14];

    const leftWrist = landmarks[15];

    const rightWrist = landmarks[16];

    const leftHip = landmarks[23];

    const rightHip = landmarks[24];

    const leftKnee = landmarks[25];

    const rightKnee = landmarks[26];

    const leftAnkle = landmarks[27];

    const rightAnkle = landmarks[28];


    const top =
        nose.y;


    const bottom =
        Math.max(
            leftAnkle.y,
            rightAnkle.y
        );


    const pixelHeight =
        bottom - top;


    function distance(a, b) {

        const dx =
            a.x - b.x;

        const dy =
            a.y - b.y;


        return Math.sqrt(
            dx * dx +
            dy * dy
        );
    }


    function cmDistance(a, b) {

        return (
            distance(a, b) /
            pixelHeight
        ) * knownHeight;
    }


    const shoulder =
        cmDistance(
            leftShoulder,
            rightShoulder
        );


    const leftArm =
        cmDistance(
            leftShoulder,
            leftElbow
        ) +
        cmDistance(
            leftElbow,
            leftWrist
        );


    const rightArm =
        cmDistance(
            rightShoulder,
            rightElbow
        ) +
        cmDistance(
            rightElbow,
            rightWrist
        );


    const arm =
        (leftArm + rightArm) / 2;


    const leftLeg =
        cmDistance(
            leftHip,
            leftKnee
        ) +
        cmDistance(
            leftKnee,
            leftAnkle
        );


    const rightLeg =
        cmDistance(
            rightHip,
            rightKnee
        ) +
        cmDistance(
            rightKnee,
            rightAnkle
        );


    const inseam =
        ((leftLeg + rightLeg) / 2) * 0.88;


    const chest =
        shoulder * 2.15;


    const waist =
        shoulder * 1.75;


    document.getElementById(
        "heightResult"
    ).innerText =
        round(knownHeight) + " cm";


    document.getElementById(
        "shoulderResult"
    ).innerText =
        round(shoulder) + " cm";


    document.getElementById(
        "armResult"
    ).innerText =
        round(arm) + " cm";


    document.getElementById(
        "inseamResult"
    ).innerText =
        round(inseam) + " cm";


    document.getElementById(
        "chestResult"
    ).innerText =
        round(chest) + " cm";


    document.getElementById(
        "waistResult"
    ).innerText =
        round(waist) + " cm";


    const uniformSize =
        calculateUniformSize(
            chest,
            waist
        );


    document.getElementById(
        "uniformSize"
    ).innerText =
        uniformSize;


    document.getElementById(
        "resultStudent"
    ).innerText =
        `${studentData.name} • ${studentData.className}`;


    hideAllSections();


    document
        .getElementById("results")
        .classList.remove("hidden");
}


/* --------------------------------------------------
   UNIFORM SIZE
-------------------------------------------------- */

function calculateUniformSize(
    chest,
    waist
) {

    if (chest < 70) {
        return "28";
    }

    if (chest < 76) {
        return "30";
    }

    if (chest < 82) {
        return "32";
    }

    if (chest < 88) {
        return "34";
    }

    if (chest < 94) {
        return "36";
    }

    return "38+";
}


/* --------------------------------------------------
   ROUNDING
-------------------------------------------------- */

function round(number) {

    return Math.round(
        number * 10
    ) / 10;
}
