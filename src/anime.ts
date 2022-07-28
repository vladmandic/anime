import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';
import { registerWebGLbackend } from './backend';
import { drawTexture } from './canvas';

const modelUrl = '../model/whitebox.json';
let resolution: [number, number] = [720, 720];
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let model: tf.GraphModel;
let alpha: tf.Tensor;

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

let t0 = performance.now();
async function runInference(frame = 0) {
  if (video.paused) {
    setTimeout(() => runInference(frame), 50);
    return;
  }
  const t: Record<string, tf.Tensor> = {};
  const t1 = performance.now();

  t.pixels = await tf.browser.fromPixelsAsync(video, 3); // read pixels from webcam
  t.resize = tf.image.resizeBilinear(t.pixels as tf.Tensor3D, resolution); // resize input
  t.div = tf.div(t.resize, 127.5); // normalize input from 0..255 to 0..2
  t.sub = tf.sub(t.div, 1); // normalize input from 0..2 to -1..1
  t.expand = tf.expandDims(t.sub, 0); // add batch dim
  t.result = model.execute(t.expand) as tf.Tensor; // model execute

  t.squeeze = tf.squeeze(t.result); // remove batch dim
  [t.red, t.green, t.blue] = tf.split(t.squeeze, 3, 2); // split rgb into separate tensors
  if (!alpha) alpha = tf.ones([...resolution, 1], 'float32'); // create alpha channel tensor once
  t.rgba = tf.stack([t.red, t.green, t.blue, alpha], 2); // restack rgb to rgba
  t.add = tf.add(t.rgba, 1); // normalize output from -1..1 to 0..2
  t.norm = tf.div(t.add, 2); // normalize output from 0..2 to 0..1
  const t2 = performance.now();

  t.data = t.norm.dataToGPU({ customTexShape: [resolution[0], resolution[1]] }); // get pointer to tensor texture
  drawTexture(canvas, t.data.texture); // draw tensor texture
  tf.dispose(t.data.tensorRef); // dispose tensor texture
  const t3 = performance.now();

  for (const tensor of Object.keys(t)) tf.dispose(t[tensor]);

  const t4 = performance.now();

  log('frame', {
    frame,
    fps: Math.round(10000 / (t4 - t0)) / 10,
    total: Math.round(t4 - t1),
    inference: Math.round(t2 - t1),
    download: Math.round(t3 - t2),
    draw: Math.round(t4 - t3),
    tensors: tf.memory().numTensors,
    bytes: tf.memory().numBytes,
    shape: t.squeeze.shape,
  });
  t0 = t4;
  setTimeout(() => runInference(++frame), 100);
  // requestAnimationFrame(() => runInference(++frame));
}

async function main() {
  log('anime');
  video = document.getElementById('video') as HTMLVideoElement;
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  await registerWebGLbackend(canvas) as WebGL2RenderingContext;
  await tf.setBackend('customgl');
  // await tf.setBackend('webgl');
  await tf.ready();
  tf.env().set('WEBGL_EXP_CONV', true);
  log('tf', tf.version_core, tf.getBackend());
  model = await tf.loadGraphModel(modelUrl);
  log('model', model);
  if (!model) return;
  if (model.inputs[0].shape) resolution = [model.inputs[0].shape[1], model.inputs[0].shape[2]];
  await startWebCam();
  runInference();
}

window.onload = main;
