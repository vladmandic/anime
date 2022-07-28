/** TFJS custom backend registration */

import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';

export const config = {
  name: 'customgl',
  priority: 999,
  canvas: <null | HTMLCanvasElement>null,
  gl: <null | WebGL2RenderingContext>null,
  extensions: <string[]> [],
  webGLattr: { // https://www.khronos.org/registry/webgl/specs/latest/1.0/#5.2
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    depth: false,
    stencil: false,
    failIfMajorPerformanceCaveat: false,
    desynchronized: true,
  },
};

function extensions(): void {
  /*
  https://www.khronos.org/registry/webgl/extensions/
  https://webglreport.com/?v=2
  */
  const gl = config.gl;
  if (!gl) return;
  config.extensions = gl.getSupportedExtensions() as string[];
  // gl.getExtension('KHR_parallel_shader_compile');
}

export async function registerWebGLbackend(canvas: HTMLCanvasElement): Promise<WebGL2RenderingContext | null> {
  config.canvas = canvas;
  if ((config.name in tf.engine().registry) && (!config.gl || !config.gl.getParameter(config.gl.VERSION))) {
    log('error: invalid context');
  }
  if (tf.findBackend(config.name)) return config.gl as WebGL2RenderingContext;
  try {
    config.gl = config.canvas?.getContext('webgl2', config.webGLattr) as WebGL2RenderingContext;
    const glv2 = config.gl.getParameter(config.gl.VERSION).includes('2.0');
    if (!glv2) {
      log('error: webgl 2.0 is not detected');
      return null;
    }
    if (config.canvas) {
      config.canvas.addEventListener('webglcontextlost', async (e) => {
        log('error:', e.type);
        throw new Error('backend error: webgl context lost');
      });
      config.canvas.addEventListener('webglcontextrestored', (e) => {
        log('error: context restored:', e);
      });
      config.canvas.addEventListener('webglcontextcreationerror', (e) => {
        log('error: context create:', e);
      });
    }
  } catch (err) {
    log('error: cannot get webgl context:', err);
    return null;
  }
  try {
    tf.setWebGLContext(2, config.gl);
  } catch (err) {
    log('error: cannot set webgl context:', err);
    return null;
  }
  try {
    const ctx = new tf.GPGPUContext(config.gl);
    tf.registerBackend(config.name, () => new tf.MathBackendWebGL(ctx), config.priority);
  } catch (err) {
    log('error: cannot register webgl backend:', err);
    return null;
  }
  try {
    const kernels = tf.getKernelsForBackend('webgl');
    kernels.forEach((kernelConfig) => {
      const newKernelConfig = { ...kernelConfig, backendName: config.name };
      tf.registerKernel(newKernelConfig);
    });
  } catch (err) {
    log('error: cannot update WebGL backend registration:', err);
    return null;
  }
  const current = tf.backend().getGPGPUContext ? tf.backend().getGPGPUContext().gl : null;
  if (current) {
    log(`humangl webgl version:${current.getParameter(current.VERSION)} renderer:${current.getParameter(current.RENDERER)}`);
  } else {
    log('error: no current gl context:', current, config.gl);
    return null;
  }
  try {
    tf.ENV.set('WEBGL_VERSION', 2);
  } catch (err) {
    log('error: cannot set WebGL backend flags:', err);
    return null;
  }
  extensions();
  log('backend registered:', config.name);
  return config.gl;
}
