import * as tf from '@tensorflow/tfjs';
import { log } from './log';

const modelUrl = '../model/model.json';
const resolution: [number, number] = [720, 720];
let model: tf.GraphModel;
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;

async function startWebCam() {
  log('starting webcam...');
  const options = { audio: false, video: { facingMode: 'user', resizeMode: 'crop', width: { ideal: resolution[0] }, height: { ideal: resolution[1] } } };
  const stream: MediaStream = await navigator.mediaDevices.getUserMedia(options);
  const ready = new Promise((resolve) => { video.onloadeddata = () => resolve(true); });
  video.srcObject = stream;
  video.play();
  await ready;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const track: MediaStreamTrack = stream.getVideoTracks()[0];
  const capabilities = track.getCapabilities ? track.getCapabilities() : '';
  const settings = track.getSettings ? track.getSettings() : '';
  const constraints = track.getConstraints ? track.getConstraints() : '';
  log('video:', video.videoWidth, video.videoHeight, track.label, { stream, track, settings, constraints, capabilities });
  canvas.onclick = () => { // pause when clicked on screen and resume on next click
    if (video.paused) {
      log('play');
      video.play();
    } else {
      log('pause');
      video.pause();
    }
  };
}

let ts = Number.MAX_SAFE_INTEGER;
async function runInference(frame = 0) {
  if (!video.paused) {
    const t0 = performance.now();
    const t: Record<string, tf.Tensor> = {};
    t.pixels = await tf.browser.fromPixelsAsync(video, 3);
    t.resize = tf.image.resizeBilinear(t.pixels as tf.Tensor3D, resolution);
    t.div = tf.div(t.resize, 127.5);
    t.sub = tf.sub(t.div, 1);
    t.expand = tf.expandDims(t.sub, 0);
    t.result = model.execute(t.expand) as tf.Tensor;

    const t1 = performance.now();
    t.squeeze = tf.squeeze(t.result);
    t.add = tf.add(t.squeeze, 1);
    t.mul = tf.mul(t.add, 127.5);
    t.cast = tf.cast(t.mul, 'int32');
    t.clip = tf.clipByValue(t.cast, 0, 255);
    await tf.browser.toPixels(t.clip as tf.Tensor3D, canvas);
    for (const tensor of Object.keys(t)) tf.dispose(t[tensor]);

    const t2 = performance.now();
    log('frame', { frame, fps: Math.round(10000 / (t2 - ts)) / 10, inference: Math.round(t1 - t0), draw: Math.round(t2 - t1), tensors: tf.memory().numTensors, bytes: tf.memory().numBytes });
    ts = t2;
  }
  setTimeout(() => runInference(++frame), 1000);
  // requestAnimationFrame(() => runInference());
}

async function main() {
  log('whitebox');
  await tf.setBackend('webgl');
  await tf.ready();
  log('tf', tf.version_core, tf.getBackend());
  if (tf.getBackend() !== 'webgl') return;
  model = await tf.loadGraphModel(modelUrl);
  if (!model) return;
  video = document.getElementById('video') as HTMLVideoElement;
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  log('model', model);
  await startWebCam();
  runInference();
}

window.onload = main;
