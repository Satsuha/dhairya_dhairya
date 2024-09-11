const canvas = document.getElementById('gestureCanvas');
const ctx = canvas.getContext('2d');
const messageDiv = document.getElementById('message');
const stopButton = document.getElementById('stopButton');
let isDrawing = false;
let points = [];
let mediaRecorder;
let audioChunks = [];
let videoChunks = [];

// Video element for video recording (not visible)
const videoPreview = document.createElement('video');
videoPreview.style.display = 'none';
document.body.appendChild(videoPreview);

// Start recording
let recordingType = ''; // Keep track if we're recording audio or video

canvas.width = 300;
canvas.height = 300;

// Store gesture templates for "<", ">", "V", "^"
const templates = {
    "<": [
        [0.8, 0.2], [0.4, 0.5], [0.8, 0.8]
    ], // For Audio recording ("<")
    ">": [
        [0.2, 0.2], [0.6, 0.5], [0.2, 0.8]
    ], // For Video recording (">")
    "V": [
        [0.2, 0.1], [0.5, 0.8], [0.8, 0.1]
    ], // For emergency call to guardians ("V")
    "^": [
        [0.5, 0.8], [0.3, 0.3], [0.7, 0.3], [0.5, 0.8]
    ]  // For alert to police ("^")
};

// Calculate angles between consecutive points
const calculateAngles = (points) => {
    const angles = [];
    for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1];
        const [x2, y2] = points[i];
        const angle = Math.atan2(y2 - y1, x2 - x1); // Angle in radians
        angles.push(angle);
    }
    return angles;
};

// Resample points to a fixed number of points
const resamplePoints = (points, numPoints) => {
    const totalLength = points.reduce((sum, point, i) => {
        if (i === 0) return sum;
        const [x1, y1] = points[i - 1];
        const [x2, y2] = point;
        return sum + Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }, 0);
    
    const intervalLength = totalLength / (numPoints - 1);
    let resampled = [points[0]];
    let distance = 0;

    for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1];
        const [x2, y2] = points[i];
        const d = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

        if (distance + d >= intervalLength) {
            const t = (intervalLength - distance) / d;
            const newX = x1 + t * (x2 - x1);
            const newY = y1 + t * (y2 - y1);
            resampled.push([newX, newY]);
            points.splice(i, 0, [newX, newY]);
            distance = 0;
        } else {
            distance += d;
        }
    }

    while (resampled.length < numPoints) {
        resampled.push(points[points.length - 1]);
    }

    return resampled;
};

// Normalize points
const normalizePoints = (points) => {
    const minX = Math.min(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1]));
    const maxX = Math.max(...points.map(p => p[0]));
    const maxY = Math.max(...points.map(p => p[1]));
    return points.map(([x, y]) => [
        (x - minX) / (maxX - minX),
        (y - minY) / (maxY - minY)
    ]);
};

// Compare gestures using angles and shape matching
const compareGestures = (drawnPoints, templatePoints) => {
    const drawnAngles = calculateAngles(drawnPoints);
    const templateAngles = calculateAngles(templatePoints);

    const angleDiff = drawnAngles.reduce((sum, angle, index) => {
        const templateAngle = templateAngles[index];
        const diff = Math.abs(angle - templateAngle);
        return sum + diff;
    }, 0);

    return angleDiff;
};

// Recognize the gesture based on comparison
const recognizeGesture = (points) => {
    const resampledPoints = resamplePoints(points, 64);
    const normalizedPoints = normalizePoints(resampledPoints);

    let bestMatch = null;
    let bestScore = Infinity;

    Object.keys(templates).forEach((gesture) => {
        const templatePoints = normalizePoints(resamplePoints(templates[gesture], 64));
        const score = compareGestures(normalizedPoints, templatePoints);

        if (score < bestScore) {
            bestScore = score;
            bestMatch = gesture;
        }
    });

    return bestMatch;
};

// Start drawing
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    points = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const x = e.offsetX;
    const y = e.offsetY;
    points.push([x, y]);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    ctx.closePath();

    const gesture = recognizeGesture(points);

    switch (gesture) {
        case '<':
            startAudioRecording();
            break;
        case '>':
            startVideoRecording();
            break;
        case 'V':
            messageDiv.textContent = 'Emergency call to guardian initiated!';
            break;
        case '^':
            messageDiv.textContent = 'Alert sent to the nearby police station!';
            break;
        default:
            messageDiv.textContent = 'Gesture not recognized. Try again.';
    }
});

// Start audio recording
function startAudioRecording() {
    messageDiv.textContent = 'Audio recording started...';
    recordingType = 'audio';

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };
            mediaRecorder.onstop = saveRecording;
            mediaRecorder.start();
            stopButton.style.display = 'block';
        });
}

// Start video recording
function startVideoRecording() {
    messageDiv.textContent = 'Video recording started...';
    recordingType = 'video';

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
                videoChunks.push(e.data);
            };
            mediaRecorder.onstop = saveRecording;
            videoPreview.srcObject = stream;
            videoPreview.play();
            mediaRecorder.start();
            stopButton.style.display = 'block';
        });
}

// Stop recording and save file
stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
    stopButton.style.display = 'none';
});

// Save recording
function saveRecording() {
    let blob;
    if (recordingType === 'audio') {
        blob = new Blob(audioChunks, { type: 'audio/webm' });
    } else if (recordingType === 'video') {
        blob = new Blob(videoChunks, { type: 'video/webm' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = recordingType === 'audio' ? 'recording.webm' : 'video.webm';
    a.click();
    
    audioChunks = [];
    videoChunks = [];
    messageDiv.textContent = 'Recording saved!';
}

