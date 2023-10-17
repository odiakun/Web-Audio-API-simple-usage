const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const playBtn = document.getElementById("play-btn");
const inputMicrophoneSelect = document.getElementById("input-mic");
const outputSpeakerSelect = document.getElementById("output-speaker");
const downloadBtn = document.getElementById("download-btn");
const pitchShiftBtn = document.getElementById("pitch-shift-btn");
const playWithDelayBtn = document.getElementById("play-with-delay-btn");
const audioPlayer = document.getElementById("audio-player");
const applyFilterBtn = document.getElementById("apply-filter-btn");
const delaySlider = document.getElementById("delay-slider");

audioPlayer.onerror = (error) => {
  console.error("Audio playback error:", error);
};

let mediaRecorder;
let recordedChunks = [];
let selectedMicrophoneId = null;
let selectedSpeakerId = null;
let audioBuffer = null;
const maxHeight = 120;
let isRecording = false;
let animationFrameId = null;
let audioContext = null;
let recordingWithDelay = false;
sourceNode = null;
filterNode = null;
delayNode = null; 
analyser = null;
gainNode = null;
let applyFilter = false;
let wasClicked = false;


function initAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}
initAudioContext();

// window.onload = async function() {
//   const deviceId = inputMicrophoneSelect.value;
//   const stream = await navigator.mediaDevices.getUserMedia({
//     audio: {
//       deviceId: selectedMicrophoneId,
//     },
//   });

//   createAnalyser(stream);
// }

async function createAnalyser(stream) {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  const sourceNode = audioContext.createMediaStreamSource(stream);
  sourceNode.connect(analyser);
}

async function startRecording() {
  if (isRecording) {
    console.log("Already recording.");
    return;
  }
  // stopRecording();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const deviceId = inputMicrophoneSelect.value;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: selectedMicrophoneId,
    },
  });

  createAnalyser(stream);

  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
      // updateAudioLevel();
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, {
      type: "audio/mp3",
    });
    const audioUrl = URL.createObjectURL(blob);
    audioPlayer.src = audioUrl;

    if (audioContext.state !== "running") {
      audioContext.resume().then(() => {
        playRecordedAudioWithDelay();
      });
    } else {
      playRecordedAudioWithDelay();
    }
  };

  sourceNode = audioContext.createMediaStreamSource(stream);

  mediaRecorder.start();
  console.log("Recording...");

  isRecording = true;
  updateAudioLevel();
}

function stopRecording() {
  if (!isRecording) {
    console.log("Not recording...");
    return;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    resetAudioLevel();
    console.log("Recording stopped!");
  }

  if (recordingWithDelay || applyFilter || isRecording) {
    if (sourceNode) {
      sourceNode.mediaStream.getAudioTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
        resetAudioLevel();
      });
      
      console.log("Microphone track stopeed")
    }

    if (delayNode || filterNode) {
      destroyMediaStreamSource();
      recordingWithDelay = false;
      applyFilter =false;
    }
  }
  
  isRecording = false;
}

function playRecordedAudioWithDelay() {
  setTimeout(() => {
    audioPlayer.play();
    console.log("Playing recorded audio with a delay...");
  }, delaySlider.value * 1000);
}

startBtn.addEventListener("click", () => {
  recordedChunks = [];
  startRecording();
});

stopBtn.addEventListener("click", () => {
  stopRecording();
});

playBtn.addEventListener("click", () => {
  audioPlayer.play();
  console.log("Playing recorded audio!");
});

downloadBtn.addEventListener("click", () => {
  if (recordedChunks.length > 0) {
    const blob = new Blob(recordedChunks, {
      type: "audio/mp3",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "recorded-audio.mp3";
    document.body.appendChild(a);

    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } else {
    console.log("No recorded audio to download.");
  }
});

async function populateInputMicrophones() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputDevices = devices.filter((device) => device.kind === "audioinput");

  inputMicrophoneSelect.innerHTML = "";
  inputDevices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text =
      device.label || `Microphone ${inputMicrophoneSelect.options.length + 1}`;
    inputMicrophoneSelect.appendChild(option);
  });
}

populateInputMicrophones();

inputMicrophoneSelect.addEventListener("change", () => {
  selectedMicrophoneId = inputMicrophoneSelect.value;
});

async function populateOutputSpeakers() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputDevices = devices.filter(
    (device) => device.kind === "audiooutput"
  );

  outputSpeakerSelect.innerHTML = "";
  outputDevices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text =
      device.label || `Speaker ${outputSpeakerSelect.options.length + 1}`;
    outputSpeakerSelect.appendChild(option);
  });
}

populateOutputSpeakers();

outputSpeakerSelect.addEventListener("change", async () => {
  selectedSpeakerId = outputSpeakerSelect.value;

  try {
    // Reset the audioPlayer's srcObject
    audioPlayer.srcObject = null;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const selectedSpeaker = devices.find(
      (device) => device.deviceId === selectedSpeakerId
    );

    if (selectedSpeaker && selectedSpeaker.kind === "audiooutput") {
      audioPlayer.setSinkId(selectedSpeaker.deviceId);
      console.log(`Audio output set to: ${selectedSpeaker.label}`);
    } else {
      console.warn(
        "Selected audio output device is not available or is not an audio output device."
      );
    }
  } catch (error) {
    console.error("Error changing audio output device:", error);
  }
});

playWithDelayBtn.addEventListener("click", () => {
  playWithDelay();
  if (isRecording) {
    return;
  }
  console.log("Started listening...");
});

async function playWithDelay() {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (isRecording) {
    console.log("Already recording.");
    return;
  }

  const deviceId = inputMicrophoneSelect.value;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId },
  });

  createAnalyser(stream);
  isRecording = true;
  updateAudioLevel();

  // Create an AnalyserNode and connect it to the sourceNode
  sourceNode = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256; // Adjust the FFT size as needed for accuracy

  delayNode = audioContext.createDelay(10);
  const gainNode = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination(stream);

  delayNode.delayTime.value = parseFloat(delaySlider.value);

  sourceNode.connect(delayNode);
  delayNode.connect(analyser); // Connect the analyser here
  analyser.connect(gainNode);
  gainNode.connect(destination);

  const audioElement = new Audio();
  audioElement.srcObject = destination.stream;
  audioElement.play();

  recordingWithDelay = true;
}

function updateAudioLevel(stream) {
  if (analyser && isRecording) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(dataArray);

    const barElement = document.querySelector(".bar");
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const averageLevel = sum / bufferLength;

    const compressedValue = Math.pow(averageLevel / 255, 1.5);
    const scaledValue = compressedValue * maxHeight * 2;

    barElement.style.height = scaledValue + "px";
    // Call this function periodically using requestAnimationFrame or a timer
    animationFrameId = requestAnimationFrame(() => updateAudioLevel(stream));
  } else {
    cancelAnimationFrame(updateAudioLevel);
  }
}

// Start the audio level visualization loop
updateAudioLevel();

function resetAudioLevel() {
  const barElement = document.querySelector(".bar");
  barElement.style.height = "0px";
}

applyFilterBtn.addEventListener("click", () => {
  applyFilterAndDelay();
  if (isRecording) {
    return;
  }
  console.log("Started listening...");
});

async function applyFilterAndDelay() {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (isRecording) {
    console.log("Already recording.");
    return;
  }

  const deviceId = inputMicrophoneSelect.value;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId },
  });

  createAnalyser(stream);
  isRecording = true;
  updateAudioLevel();

  // Create an AnalyserNode and connect it to the sourceNode
  sourceNode = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256; // Adjust the FFT size as needed for accuracy

  const filterNode = audioContext.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.value = 1000;

  delayNode = audioContext.createDelay(10);
  const gainNode = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination(stream);

  delayNode.delayTime.value = parseFloat(delaySlider.value);

  sourceNode.connect(filterNode);
  filterNode.connect(delayNode);
  delayNode.connect(analyser); // Connect the analyser here
  analyser.connect(gainNode);
  gainNode.connect(destination);

  const audioElement = new Audio();
  audioElement.srcObject = destination.stream;
  audioElement.play();

  applyFilter = true;
}

function destroyMediaStreamSource() {
  if (sourceNode){
    sourceNode.disconnect();
  }
  if (filterNode){
    filterNode.disconnect();
  }
  if (delayNode){
    delayNode.disconnect();
  }
  if (analyser){
    analyser.disconnect();
  }
  if (gainNode){
    gainNode.disconnect();
  }
  console.log("Nodes are disconnected now");

  sourceNode = null;
  filterNode = null;
  delayNode = null; 
  analyser = null;
  gainNode = null;
}