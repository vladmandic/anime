import { log } from './log';

const resolution: [number, number] = [720, 720];
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let ws: WebSocket;
let ctx: CanvasRenderingContext2D;

async function startWebCam() {
  log('starting webcam...');
  video = document.getElementById('video') as HTMLVideoElement;
  const options = { audio: false, video: { facingMode: 'user', resizeMode: 'crop', width: { ideal: resolution[0] }, height: { ideal: resolution[1] } } };
  const stream: MediaStream = await navigator.mediaDevices.getUserMedia(options);
  const ready = new Promise((resolve) => { video.onloadeddata = () => resolve(true); });
  video.srcObject = stream;
  video.play();
  await ready;
  const track: MediaStreamTrack = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : '';
  const settings = track.getSettings ? track.getSettings() : '';
  const constraints = track.getConstraints ? track.getConstraints() : '';
  log('video:', video.videoWidth, video.videoHeight, track.label, { stream, track, settings, constraints, capabilities });
  video.onclick = () => { // pause when clicked on screen and resume on next click
    if (video.paused) {
      log('play');
      video.play();
    } else {
      log('pause');
      video.pause();
    }
  };
}

let localCanvas: HTMLCanvasElement;
let localCanvasCtx: CanvasRenderingContext2D;

async function sendData() {
  if (!localCanvas) {
    localCanvas = document.createElement('canvas') as HTMLCanvasElement;
    localCanvas.width = resolution[0];
    localCanvas.height = resolution[1];
  }
  if (!localCanvasCtx) {
    localCanvasCtx = localCanvas.getContext('2d') as CanvasRenderingContext2D;
  }
  localCanvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, localCanvas.width, localCanvas.height);
  const imageData = localCanvasCtx.getImageData(0, 0, localCanvas.width, localCanvas.height);
  if (ws.readyState === 1) ws.send(imageData.data);
}

async function receiveData(data: Blob) {
  if (!canvas) {
    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.width = resolution[0];
    canvas.height = resolution[1];
  }
  if (!ctx) {
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }
  const buffer = await data.arrayBuffer();
  const view = new Uint8ClampedArray(buffer);
  const imageData = new ImageData(view, resolution[0], resolution[1]);
  ctx.putImageData(imageData, 0, 0);
  requestAnimationFrame(sendData); // trigger new frame
}

async function startSockets() {
  ws = new WebSocket('ws://localhost:8080');
  ws.onopen = () => {
    log('ws open');
    sendData(); // initial send
  };
  ws.onerror = () => log('ws error');
  ws.onclose = () => log('ws close');
  ws.onmessage = async (message) => receiveData(message.data);
}

async function main() {
  log('anime');
  await startWebCam();
  startSockets();
}

window.onload = main;
