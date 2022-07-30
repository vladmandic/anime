import * as fs from 'fs';
import * as sharp from 'sharp';
import { log } from './log';

export async function readImage(imageUrl, resolution): Promise<Buffer> {
  const bytes = fs.readFileSync(imageUrl);
  const decoded = await sharp.default(bytes);
  const metadata = await decoded.metadata();
  log('image read', { url: imageUrl, format: metadata.format, size: metadata.size, resolution: [metadata.width, metadata.height] });
  const { data, info } = await sharp.default(bytes).resize(...resolution).raw().toBuffer({ resolveWithObject: true });
  log('image read buffer', { format: info.format, resolution: [info.width, info.height] });
  return data;
}

export async function writeImage(outputUrl, resolution, data) {
  const output = await sharp.default(data, { raw: { width: resolution[0], height: resolution[1], channels: 4, premultiplied: false } }).toFile(outputUrl);
  log('image write', { url: outputUrl, format: output.format, size: output.size, resolution: [output.width, output.height] });
}
