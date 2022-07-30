import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';
import { registerWebGLbackend } from './glbackend';
import { drawTexture, syncWait } from './gldraw';

const modelUrl = '../model/whitebox.json';
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let resolution: [number, number] = [720, 720]; // dynamically updated based on model input signature
let model: tf.GraphModel; // loaded tfjs graph model
let alpha: tf.Tensor; // tensor with alpha values used to expand rgb to rgba
const t: Record<string, tf.Tensor> = {}; // object that will hold all created tensors

async function startWebCam() {
  log('starting webcam...');
  const options = { audio: false, video: { facingMode: 'user', resizeMode: 'crop', width: { ideal: resolution[0] }, height: { ideal: resolution[1] } } };
  const stream: MediaStream = await navigator.mediaDevices.getUserMedia(options);
  const ready = new Promise((resolve) => { video.onloadeddata = () => resolve(true); });
  video.onplay = () => log('video play');
  video.onpause = () => log('video pause');
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
    if (video.paused) video.play();
    else video.pause();
  };
}

let t0 = performance.now();
async function runInference(frame = 0) {
  if (video.paused) {
    setTimeout(() => runInference(frame), 50);
    return;
  }
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
  t.data = t.norm.dataToGPU({ customTexShape: [resolution[0], resolution[1]] }); // get pointer to tensor texture
  t.reference = t.data.tensorRef; // makes texture reference tensor visible within t object so it can be auto-disposed

  const processor = drawTexture(canvas, t.data.texture); // draw tensor texture
  const sync = await syncWait(processor.gl); // wait for all gl commands on a given context to complete

  const t2 = performance.now();
  if (frame % 10 === 0) { // print stats every 10 frames
    log('frame', { frame, fps: Math.round(10000 / (t2 - t0)) / 10, real: Math.round(t2 - t0), sync: Math.round(sync), inside: Math.round(t2 - t1), outside: Math.round(t1 - t0), tensors: tf.memory().numTensors });
  }
  t0 = t2;
  Object.values(t).forEach((tensor) => tf.dispose(tensor));

  // setTimeout(() => runInference(++frame), 0);
  // requestAnimationFrame(() => runInference(++frame));
  video.requestVideoFrameCallback(() => runInference(++frame));
}

async function main() {
  log('anime');
  video = document.getElementById('video') as HTMLVideoElement;
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  await registerWebGLbackend(canvas) as WebGL2RenderingContext;
  await tf.setBackend('customgl');
  await tf.ready();
  tf.env().set('WEBGL_EXP_CONV', true);
  model = await tf.loadGraphModel(modelUrl);
  if (!model) return;
  log('tf', { version: tf.version_core, backend: tf.getBackend(), model: model.modelUrl });
  if (model.inputs[0].shape) resolution = [model.inputs[0].shape[1], model.inputs[0].shape[2]];
  await startWebCam();
  await runInference();
}

window.onload = main;
