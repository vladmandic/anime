import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';

const modelUrl = '../model/whitebox.json';
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
let alpha: tf.Tensor;
async function runInference(frame = 0) {
  if (!video.paused) {
    const t0 = performance.now();

    const t: Record<string, tf.Tensor> = {};
    t.pixels = await tf.browser.fromPixelsAsync(video, 3);
    t.resize = tf.image.resizeBilinear(t.pixels as tf.Tensor3D, resolution);
    t.div = tf.div(t.resize, 127.5);
    t.sub = tf.sub(t.div, 1);
    t.expand = tf.expandDims(t.sub, 0);
    const t1 = performance.now();

    t.result = await model.executeAsync(t.expand) as tf.Tensor;
    const t2 = performance.now();

    t.squeeze = tf.squeeze(t.result);
    [t.red, t.green, t.blue] = tf.split(t.squeeze, 3, 2);
    if (!alpha) alpha = tf.ones([...resolution, 1], 'float32'); // create alpha channel tensor once
    t.rgba = tf.stack([t.red, t.green, t.blue, alpha], 2); // restack rgb to rgba
    t.add = tf.add(t.rgba, 1);
    t.mul = tf.mul(t.add, 127.5);
    t.cast = tf.cast(t.mul, 'int32');
    t.clip = tf.clipByValue(t.cast, 0, 255);
    const t3 = performance.now();

    const data = await t.clip.data();
    const t4 = performance.now();

    const arr = Uint8ClampedArray.from(data);
    const imageData = new ImageData(arr, 720, 720);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.putImageData(imageData, 0, 0);
    const t5 = performance.now();

    // await tf.browser.toPixels(t.clip as tf.Tensor3D, canvas);
    for (const tensor of Object.keys(t)) tf.dispose(t[tensor]);

    log('frame', {
      frame,
      fps: Math.round(10000 / (t2 - ts)) / 10,
      total: Math.round(t5 - t0),
      prepare: Math.round(t1 - t0),
      inference: Math.round(t2 - t1),
      process: Math.round(t3 - t2),
      download: Math.round(t4 - t3),
      draw: Math.round(t5 - t4),
      tensors: tf.memory().numTensors,
      bytes: tf.memory().numBytes,
    });
    ts = t2;
  }
  // setTimeout(() => runInference(++frame), 5000);
  requestAnimationFrame(() => runInference(++frame));
}

async function main() {
  log('anime');
  await tf.setBackend('webgl');
  await tf.ready();
  tf.env().set('WEBGL_EXP_CONV', true);
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
