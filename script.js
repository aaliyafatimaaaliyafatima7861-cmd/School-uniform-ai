/* ==================================================
   SCHOOL UNIFORM AI - DIAGNOSTIC VERSION
================================================== */

let poseLandmarker = null;

let video = document.getElementById("camera");
let canvas = document.getElementById("poseCanvas");
let ctx = canvas.getContext("2d");

let stream = null;
let latestLandmarks = null;
let studentData = {};
let personReady = false;
let previousTime = -1;
let detectionStarted = false;


/* ==================================================
   PAGE NAVIGATION
================================================== */

function hideAllSections() {

    document.getElementById("intro").classList.add("hidden");
    document.getElementById("studentForm").classList.add("hidden");
    document.getElementById("cameraSection").classList.add("hidden");
    document.getElementById("processing").classList.add("hidden");
    document.getElementById("results").classList.add("hidden");
}


window.showStudentForm = function () {

    hideAllSections();

    document
        .getElementById("studentForm")
        .classList
        .remove("hidden");
};


/* ==================================================
   DIAGNOSTIC ERROR DISPLAY
================================================== */

function showDiagnosticError(title, error) {

    console.error(title, error);


    let details = "";

    if (error) {

        details =
            "Error name: " +
            (error.name || "Unknown") +
            "\n\n" +

            "Error message:\n" +
            (error.message || error) +
            "\n\n" +

            "Browser:\n" +
            navigator.userAgent;
    }


    /*
     * Show error directly on the webpage.
     */

    hideAllSections();


    const cameraSection =
        document.getElementById(
            "cameraSection"
        );


    cameraSection.classList.remove(
        "hidden"
    );


    const instruction =
        document.getElementById(
            "instruction"
        );


    instruction.innerText =
        "❌ AI SYSTEM ERROR";


    const statusText =
        document.getElementById(
            "statusText"
        );


    statusText.innerText =
        title +
        "\n\n" +
        details;


    const light =
        document.getElementById(
            "statusLight"
        );


    light.style.background =
        "#eb3b5a";


    /*
     * Also show an alert.
     */

    alert(
        title +
        "\n\n" +
        details
    );
}


/* ==================================================
   START MEASUREMENT
================================================== */

window.startCamera = async function () {

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


    if (
        height < 80 ||
        height > 220
    ) {

        alert(
            "Please enter a realistic height between 80 and 220 cm."
        );

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
        .classList
        .remove("hidden");


    setStatus(
        "yellow",
        "Opening camera..."
    );


    try {

        /*
         * STEP 1
         * CAMERA
         */

        await openCamera();


        setStatus(
            "yellow",
            "Camera works ✓\nLoading AI..."
        );


        /*
         * STEP 2
         * MEDIAPIPE
         */

        await setupPoseDetection();


        setStatus(
            "yellow",
            "AI loaded ✓\nDetecting body..."
        );


    } catch (error) {

        stopCamera();


        showDiagnosticError(
            "AI body detection could not load.",
            error
        );
    }
};


/* ==================================================
   CAMERA
================================================== */

async function openCamera() {

    console.log(
        "STEP 1: Checking camera API..."
    );


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Camera API is not supported by this browser."
        );
    }


    console.log(
        "STEP 2: Requesting camera permission..."
    );


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


    console.log(
        "STEP 3: Camera permission granted."
    );


    video.srcObject =
        stream;


    video.muted =
        true;


    video.playsInline =
        true;


    video.autoplay =
        true;


    await video.play();


    await waitForVideo();


    canvas.width =
        video.videoWidth || 720;


    canvas.height =
        video.videoHeight || 960;


    console.log(
        "STEP 4: Camera is running."
    );
}


/* ==================================================
   WAIT FOR VIDEO
================================================== */

function waitForVideo() {

    return new Promise(
        (resolve, reject) => {

            if (
                video.readyState >= 2 &&
                video.videoWidth > 0
            ) {

                resolve();

                return;
            }


            const timeout =
                setTimeout(
                    () => {

                        reject(
                            new Error(
                                "Camera opened but video dimensions were not available."
                            )
                        );

                    },

                    10000
                );


            video.onloadedmetadata =
                function () {

                    clearTimeout(
                        timeout
                    );

                    resolve();

                };
        }
    );
}


/* ==================================================
   MEDIAPIPE DIAGNOSTIC
================================================== */

async function setupPoseDetection() {

    console.log(
        "STEP 5: Starting MediaPipe test..."
    );


    /*
     * TEST 1:
     * Check internet connection.
     */

    setStatus(
        "yellow",
        "Testing internet connection..."
    );


    try {

        const testResponse =
            await fetch(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/package.json",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        console.log(
            "CDN response:",
            testResponse.status
        );


        if (!testResponse.ok) {

            throw new Error(
                "MediaPipe CDN returned HTTP " +
                testResponse.status
            );
        }


        console.log(
            "STEP 6: MediaPipe CDN is reachable ✓"
        );


    } catch (error) {

        throw new Error(
            "Cannot reach MediaPipe CDN.\n\n" +
            "CDN test failed.\n\n" +
            "Original error: " +
            error.message
        );
    }


    /*
     * TEST 2:
     * Import MediaPipe.
     */

    setStatus(
        "yellow",
        "Downloading MediaPipe..."
    );


    let module;


    try {

        module =
            await import(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm"
            );


        console.log(
            "STEP 7: MediaPipe package loaded ✓"
        );


    } catch (error) {

        throw new Error(
            "MediaPipe JavaScript package failed to load.\n\n" +
            error.message
        );
    }


    if (
        !module.FilesetResolver ||
        !module.PoseLandmarker
    ) {

        throw new Error(
            "MediaPipe loaded, but FilesetResolver or PoseLandmarker is missing."
        );
    }


    const FilesetResolver =
        module.FilesetResolver;


    const PoseLandmarker =
        module.PoseLandmarker;


    /*
     * TEST 3:
