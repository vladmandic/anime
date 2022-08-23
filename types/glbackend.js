/** TFJS custom backend registration */
import * as tf from '@vladmandic/tfjs/dist/tfjs.esm';
import { log } from './log';
export const config = {
    name: 'customgl',
    priority: 999,
    canvas: null,
    gl: null,
    extensions: [],
    webGLattr: {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        depth: false,
        stencil: false,
        failIfMajorPerformanceCaveat: false,
        desynchronized: false,
    },
};
export async function registerWebGLbackend(canvas) {
    config.canvas = canvas;
    if (tf.findBackend(config.name))
        return config.gl;
    try {
        config.gl = config.canvas?.getContext('webgl2', config.webGLattr);
        const glv2 = config.gl.getParameter(config.gl.VERSION).includes('2.0');
        if (!glv2) {
            log('error: webgl 2.0 is not detected');
            return null;
        }
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
    catch (err) {
        log('error: cannot get webgl context:', err);
        return null;
    }
    try {
        tf.setWebGLContext(2, config.gl);
    }
    catch (err) {
        log('error: cannot set webgl context:', err);
        return null;
    }
    try {
        const ctx = new tf.GPGPUContext(config.gl);
        tf.registerBackend(config.name, () => new tf.MathBackendWebGL(ctx), config.priority);
    }
    catch (err) {
        log('error: cannot register webgl backend:', err);
        return null;
    }
    try {
        const kernels = tf.getKernelsForBackend('webgl');
        kernels.forEach((kernelConfig) => {
            const newKernelConfig = { ...kernelConfig, backendName: config.name };
            tf.registerKernel(newKernelConfig);
        });
    }
    catch (err) {
        log('error: cannot update WebGL backend registration:', err);
        return null;
    }
    const current = tf.backend().getGPGPUContext ? tf.backend().getGPGPUContext().gl : null;
    if (current)
        log(`webgl version:${current.getParameter(current.VERSION)} renderer:${current.getParameter(current.RENDERER)}`);
    else
        log('error: no current gl context:', current, config.gl);
    tf.ENV.set('WEBGL_VERSION', 2);
    log('backend registered:', config.name);
    return config.gl;
}
//# sourceMappingURL=glbackend.js.map