/*
  anime
  homepage: <https://github.com/vladmandic/anime>
  author: <https://github.com/vladmandic>'
*/

// src/log.ts
var log = (...msg) => {
  const dt = new Date();
  const ts = `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}:${dt.getSeconds().toString().padStart(2, "0")}.${dt.getMilliseconds().toString().padStart(3, "0")}`;
  console.log(ts, ...msg);
};

// src/sockets.ts
var resolution = [720, 720];
var video;
var canvas;
var ws;
var ctx;
async function startWebCam() {
  log("starting webcam...");
  video = document.getElementById("video");
  const options = { audio: false, video: { facingMode: "user", resizeMode: "crop", width: { ideal: resolution[0] }, height: { ideal: resolution[1] } } };
  const stream = await navigator.mediaDevices.getUserMedia(options);
  const ready = new Promise((resolve) => {
    video.onloadeddata = () => resolve(true);
  });
  video.srcObject = stream;
  video.play();
  await ready;
  const track = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : "";
  const settings = track.getSettings ? track.getSettings() : "";
  const constraints = track.getConstraints ? track.getConstraints() : "";
  log("video:", video.videoWidth, video.videoHeight, track.label, { stream, track, settings, constraints, capabilities });
  video.onclick = () => {
    if (video.paused) {
      log("play");
      video.play();
    } else {
      log("pause");
      video.pause();
    }
  };
}
var localCanvas;
var localCanvasCtx;
async function sendData() {
  if (!localCanvas) {
    localCanvas = document.createElement("canvas");
    localCanvas.width = resolution[0];
    localCanvas.height = resolution[1];
  }
  if (!localCanvasCtx) {
    localCanvasCtx = localCanvas.getContext("2d");
  }
  localCanvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, localCanvas.width, localCanvas.height);
  const imageData = localCanvasCtx.getImageData(0, 0, localCanvas.width, localCanvas.height);
  if (ws.readyState === 1)
    ws.send(imageData.data);
}
async function receiveData(data) {
  if (!canvas) {
    canvas = document.getElementById("canvas");
    canvas.width = resolution[0];
    canvas.height = resolution[1];
  }
  if (!ctx) {
    ctx = canvas.getContext("2d");
  }
  const buffer = await data.arrayBuffer();
  const view = new Uint8ClampedArray(buffer);
  const imageData = new ImageData(view, resolution[0], resolution[1]);
  ctx.putImageData(imageData, 0, 0);
  requestAnimationFrame(sendData);
}
async function startSockets() {
  ws = new WebSocket("ws://localhost:8080");
  ws.onopen = () => {
    log("ws open");
    sendData();
  };
  ws.onerror = () => log("ws error");
  ws.onclose = () => log("ws close");
  ws.onmessage = async (message) => receiveData(message.data);
}
async function main() {
  log("anime");
  await startWebCam();
  startSockets();
}
window.onload = main;
//# sourceMappingURL=sockets.js.map
