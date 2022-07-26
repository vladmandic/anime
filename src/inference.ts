import * as tf from '@tensorflow/tfjs-node-gpu';
import { log } from './log';

const modelUrl = 'file://model/whitebox.json';
let model: tf.GraphModel;
let alpha: tf.Tensor;
let resolution: [number, number] = [720, 720];

export async function runInference(buffer: Buffer): Promise<Float32Array | undefined> {
  if (!model) {
    model = await tf.loadGraphModel(modelUrl);
    // @ts-ignore
    log('model', { url: model.modelUrl, shape: model.inputs[0]?.shape });
    if (!model) return undefined;
    if (model.inputs[0].shape) resolution = [model.inputs[0].shape[1], model.inputs[0].shape[2]];
  }

  // const t0 = performance.now();
  const t: Record<string, tf.Tensor> = {};

  // create input tensor
  const channels = buffer.length / resolution[0] / resolution[1];
  if (channels === 3) {
    t.input = tf.tensor(buffer, [...resolution, 3]);
  } else if (channels === 4) {
    t.rgba = tf.tensor(buffer, [...resolution, 4]);
    t.input = tf.slice(t.rgba, [0, 0, 0], [-1, -1, 3]); // strip alpha channel
  } else {
    log('input error');
    return undefined;
  }

  // normalize from 0..255 to -1..1 and add batch dim
  t.div = tf.div(t.input, 127.5);
  t.sub = tf.sub(t.div, 1);
  t.expand = tf.expandDims(t.sub, 0);

  // run model inference
  t.result = model.execute(t.expand) as tf.Tensor;
  // const t1 = performance.now();

  // convert output from rgb to rgba
  t.squeeze = tf.squeeze(t.result);
  const [red, green, blue] = tf.split(t.squeeze, 3, 2);
  if (!alpha) alpha = tf.ones([...resolution, 1], 'float32'); // create alpha channel tensor once
  t.rgba = tf.stack([red, green, blue, alpha], 2);
  tf.dispose([red, green, blue]); // manually dispose

  // normalize output from -1..1 to 0..255 and remove batch dim
  t.add = tf.add(t.rgba, 1);
  t.mul = tf.mul(t.add, 127.5);
  t.final = tf.squeeze(t.mul, [3]);

  // download data and dispose all tensors
  const data = await t.final.dataSync() as Float32Array;
  for (const tensor of Object.keys(t)) tf.dispose(t[tensor]);

  // const t2 = performance.now();
  // log('run', { total: Math.round(t2 - t0), inference: Math.round(t1 - t0), process: Math.round(t2 - t1), tensors: tf.memory().numTensors });
  return data;
}
