import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';
// import { registerWebGLbackend } from './backend';
// import { drawTexture, loadTexture, initScene } from './webgl';

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
  if (!video.paused) {
    const t: Record<string, tf.Tensor> = {};
    const t1 = performance.now();

    t.pixels = await tf.browser.fromPixelsAsync(video, 3);
    t.resize = tf.image.resizeBilinear(t.pixels as tf.Tensor3D, resolution);
    t.div = tf.div(t.resize, 127.5);
    t.sub = tf.sub(t.div, 1);
    t.expand = tf.expandDims(t.sub, 0);
    t.result = model.execute(t.expand) as tf.Tensor;
    t.squeeze = tf.squeeze(t.result);
    [t.red, t.green, t.blue] = tf.split(t.squeeze, 3, 2);
    if (!alpha) alpha = tf.ones([...resolution, 1], 'float32'); // create alpha channel tensor once
    t.rgba = tf.stack([t.red, t.green, t.blue, alpha], 2); // restack rgb to rgba
    t.add = tf.add(t.rgba, 1);
    t.mul = tf.mul(t.add, 127.5);
    t.cast = tf.cast(t.mul, 'int32');
    t.clip = tf.clipByValue(t.cast, 0, 255);
    t.norm = tf.squeeze(t.clip);
    const t2 = performance.now();

    const data = t.norm.dataSync();
    const t3 = performance.now();

    const arr = Uint8ClampedArray.from(data);
    const imageData = new ImageData(arr, resolution[0], resolution[1]);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.putImageData(imageData, 0, 0);

    // t.data = t.norm.dataToGPU({ customTexShape: [resolution[0], resolution[1]] });
    // await drawTexture(t.data.texture);

    // await tf.browser.toPixels(t.norm as tf.Tensor3D, canvas);

    for (const tensor of Object.keys(t)) tf.dispose(t[tensor]);

    const t4 = performance.now();

    if (frame % 10 === 0) {
      log('frame', {
        frame,
        fps: Math.round(10000 / (t4 - t0)) / 10,
        total: Math.round(t4 - t1),
        inference: Math.round(t2 - t1),
        download: Math.round(t3 - t2),
        draw: Math.round(t4 - t3),
        tensors: tf.memory().numTensors,
        bytes: tf.memory().numBytes,
      });
    }
    t0 = t4;
  }
  requestAnimationFrame(() => runInference(++frame));
}

async function main() {
  log('anime');
  video = document.getElementById('video') as HTMLVideoElement;
  canvas = document.getElementById('canvas') as HTMLCanvasElement;
  // const gl = await registerWebGLbackend(canvas) as WebGL2RenderingContext;
  // await tf.setBackend('customgl');
  await tf.setBackend('webgl');
  await tf.ready();
  tf.env().set('WEBGL_EXP_CONV', true);
  log('tf', tf.version_core, tf.getBackend());
  model = await tf.loadGraphModel(modelUrl);
  log('model', model);
  if (!model) return;
  if (model.inputs[0].shape) resolution = [model.inputs[0].shape[1], model.inputs[0].shape[2]];
  await startWebCam();

  /*
  await initScene({ canvas });
  await initScene({ context: gl });
  const texture = await loadTexture('../assets/out.jpg');
  await drawTexture(texture);
  const tensor = await tf.browser.fromPixelsAsync(video, 4);
  const tensorData = tensor.dataToGPU({ customTexShape: [resolution[0], resolution[1]] });
  await drawTexture(tensorData.texture);
  tf.dispose([tensor, tensorData]);
  */

  runInference();
}

window.onload = main;
