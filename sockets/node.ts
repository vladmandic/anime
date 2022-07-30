import * as tf from '@tensorflow/tfjs-node-gpu';
import { readImage } from './image';
import { log } from './log';
import { sendServer, startServer } from './server';

const imageUrl = 'assets/me.jpg';
const resolution: [number, number] = [720, 720];
const socketsPort = 8080;

async function test() {
  const imgData = await readImage(imageUrl, resolution);
  sendServer(imgData);
}

async function main() {
  log('anime');
  await tf.ready();
  log('tf', tf.version_core, tf.getBackend());
  startServer(socketsPort);

  test(); // run test once

  // process stays open as websocket server is started
}

main();
