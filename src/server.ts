import { WebSocketServer, WebSocket } from 'ws';
import { log } from './log';
import { runInference } from './inference';
import { writeImage } from './image';

const resolution: [number, number] = [720, 720];
const outputUrl = 'assets/out.jpg';
const serverUrl = 'ws://localhost:8080';
let client;

export function startServer(port) {
  log('wss server', { port });
  const server = new WebSocketServer({ port });
  server.on('connection', (connection) => {
    log('wss connection');
    connection.onmessage = async (message) => {
      // log('wss message', { length: message.data.length });
      const data = await runInference(message.data);
      const bytes = data ? Uint8Array.from(data as Float32Array) : [];
      connection.send(bytes);
    };
  });
}

export function sendServer(data) {
  if (!client || client.readyState !== 1) {
    client = new WebSocket(serverUrl);
    client.onopen = () => log('wsc open');
    client.onerror = () => log('wsc error');
    client.onclose = () => log('wsc close');
    client.onmessage = async (message) => {
      // log('wsc message', { length: message.data.length });
      writeImage(outputUrl, resolution, message.data);
    };
  }
  if (client.readyState !== 1) setTimeout(() => sendServer(data), 100);
  else client.send(data);
}
