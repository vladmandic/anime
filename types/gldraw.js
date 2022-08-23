/* eslint-disable max-classes-per-file */
const glError = (gl, label) => {
    const err = gl.getError();
    if (err !== gl.NO_ERROR)
        throw new Error(`glError: ${label} ${err}`);
    return err !== gl.NO_ERROR;
};
class GLTexture {
    texture;
    width;
    height;
    gl;
    constructor(gl, texture, width, height) {
        this.gl = gl;
        this.texture = texture;
        this.width = width;
        this.height = height;
    }
    bindTexture() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    }
}
class GLFrameBuffer extends GLTexture {
    framebuffer;
    format;
    constructor(gl, width, height, options) {
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('createTexture: framebuffer');
        super(gl, texture, width, height);
        this.framebuffer = gl.createFramebuffer();
        this.format = options.format;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        glError(gl, 'bindFramebuffer');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        const format = this.format === 'rgba' ? gl.RGBA : gl.RGB;
        gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, gl.UNSIGNED_BYTE, null);
        glError(gl, 'createTexture');
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`checkFramebufferStatus: ${status}`);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    }
    bindFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.gl.viewport(0, 0, this.width, this.height);
    }
}
const compileShader = (gl, type, src) => {
    const shader = gl.createShader(type);
    if (!shader)
        throw new Error(`compileShader: ${type}`);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const err = gl.getShaderInfoLog(shader);
    if (err)
        throw new Error(`compileShader: ${err}`);
    return shader;
};
class GLProgram {
    program;
    cachedUniformLocations;
    gl;
    constructor(gl, vertexSrc, fragmentSrc) {
        this.gl = gl;
        const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
        glError(gl, 'compileShader: vertex');
        const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        glError(gl, 'compileShader: fragment');
        this.program = gl.createProgram();
        if (!this.program || !vertexShader || !fragmentShader)
            throw new Error('createProgram');
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.bindAttribLocation(this.program, 0, 'position');
        gl.bindAttribLocation(this.program, 1, 'input_tex_coord');
        gl.linkProgram(this.program);
        gl.useProgram(this.program);
        glError(gl, 'createProgram');
        this.cachedUniformLocations = new Map();
    }
    useProgram() {
        this.gl.useProgram(this.program);
    }
    getUniformLocation(symbol) {
        if (this.cachedUniformLocations.has(symbol))
            return this.cachedUniformLocations.get(symbol);
        const location = this.gl.getUniformLocation(this.program, symbol);
        this.cachedUniformLocations.set(symbol, location);
        if (!location)
            throw new Error(`getUniformLocation: ${symbol}`);
        return location;
    }
}
class GLProcessor {
    program;
    frame;
    gl;
    options;
    squareVerticesBuffer;
    textureVerticesBuffer;
    vertexShaderSrc = `#version 300 es
    precision mediump float;
    in vec4 position;
    in vec4 input_tex_coord;
    out vec2 tex_coord;
    void main() {
      gl_Position = position; // set pixel position
      tex_coord = input_tex_coord.xy; // passthrough texture position
    }`;
    fragmentShaderSrc = `#version 300 es
    precision mediump float;
    uniform int rgba;
    uniform sampler2D mask;
    in highp vec2 tex_coord;
    out vec4 out_color;
    void main() {
      if (rgba == 1) { // rgba format
        vec4 in_color = texture(mask, tex_coord).rgba;
        out_color = vec4(in_color.rgba);
      } else { // rgb format
        vec3 in_color = texture(mask, tex_coord).rgb;
        out_color = vec4(in_color.rgb, 1.0);    
      }
      if (out_color.r > 1.0) out_color = vec4(out_color.r / 255.0, out_color.g / 255.0, out_color.b / 255.0, 1.0); // silly normalization from 0..255 to 0..1
    }`;
    constructor(gl, options) {
        this.gl = gl;
        this.options = options;
        this.gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // initial set viewport
        this.gl.scissor(0, 0, gl.canvas.width, gl.canvas.height); // initial set scissor
        this.program = new GLProgram(this.gl, this.vertexShaderSrc, this.fragmentShaderSrc); // create vertex and fragment shader programs
        this.frame = new GLFrameBuffer(this.gl, gl.canvas.width, gl.canvas.height, this.options); // create initial framebuffer
        this.squareVerticesBuffer = this.gl.createBuffer(); // create vertices that cover entire draw area as square
        if (!this.squareVerticesBuffer)
            throw new Error('squareVerticesBuffer');
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.squareVerticesBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, Float32Array.from([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        this.textureVerticesBuffer = this.gl.createBuffer(); // create texture vertices that accompany square
        if (!this.textureVerticesBuffer)
            throw new Error('textureVerticesBuffer');
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureVerticesBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, Float32Array.from([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = this.program.getUniformLocation('rgba');
        this.gl.uniform1i(loc, this.options.format === 'rgba' ? 1 : 0); // and bind a uniform
    }
    bindTextures(textures) {
        let textureId = 0;
        for (const [name, texture] of textures) {
            const loc = this.program.getUniformLocation(name);
            this.gl.activeTexture(this.gl.TEXTURE0 + textureId); // make texture active
            texture.bindTexture(); // bind it for future operations
            this.gl.uniform1i(loc, textureId); // and bind a uniform
            textureId++;
        }
    }
    flipFramebuffers() {
        this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null); // set rendering back to default framebuffer
        this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, this.frame.framebuffer); // cache data from result texture drawn in the gl.READ_FRAMEBUFFER
        this.gl.blitFramebuffer(0, 0, this.frame.width, this.frame.height, 0, this.frame.height, this.frame.width, 0, this.gl.COLOR_BUFFER_BIT, this.gl.LINEAR); // transfer data from read framebuffer to default framebuffer
    }
    drawVertices() {
        this.gl.enableVertexAttribArray(0);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.squareVerticesBuffer);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(1);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureVerticesBuffer);
        this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}
let processor; // class instance created on first use
/**
 * Draw WebGL texture onto canvas
 * Used when image data is already uploaded to GPU to achieve fast draw without need to download data to CPU and upload to canvas
 *
 * @param canvas
 * HTMLCanvasElement to draw texture on
 * Canvas must have WebGL2 context and that context must be same shared with TFJS WebGL backend engine
 * Suggestion is to egister a custom TFJS WebGL backend engine that uses canvas WebGL2 context as internal context
 * see <backend.ts:registerWebGLbackend()> for example
 *
 * @param texture
 * WebGLTexture texture to draw
 * input texture is assumed to have shape [Width, Height, RGBA|RGB]
 * Texture can be in 0..1 or 0..255 color range
 * Texture can be in RGBA or RGB format (see options)
 *
 * @param options
 * WebGL texture options
 * format: 'rgba' assumes input texture is in [RGBA] format // working
 * format: 'rgb'  assumes input texture is in [RGB] format // in progress
 * @returns instance of GLProcessor
 */
export function drawTexture(canvas, texture, options = { format: 'rgba' }) {
    if (processor?.gl?.canvas !== canvas) {
        const gl = canvas.getContext('webgl2');
        if (!gl)
            throw new Error('webgl2 getContext');
        processor = new GLProcessor(gl, options); // creates one instance of the main class
    }
    const mask = new GLTexture(processor.gl, texture, processor.frame.width, processor.frame.height); // create usable texture from tensor data
    processor.program.useProgram(); // switch to this program if something else was using webgl
    processor.bindTextures([['mask', mask]]); // upload texture to gpu
    processor.frame.bindFramebuffer(); // bind to our framebuffer
    processor.drawVertices(); // draw textures using square vertices
    processor.flipFramebuffers(); // flip read framebuffer to draw framebuffer
    return processor;
}
/**
 * Wait for completion of any pending GL commands
 * This is a standalone function  and can be used with a default WebGL backend
 * Example: `await syncWait(tf.backend().getGPGPUContext().gl);`
 * @param canvas HTMLCanvasElement for which WebGL2 context we'll wait for GL command completion
 * @returns number how long the synchronization took in ms
 */
export async function syncWait(gl) {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync)
        return 0;
    const ts = performance.now();
    return new Promise((resolve) => {
        const loop = () => {
            const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
            if (status === gl.WAIT_FAILED)
                throw new Error('clientWaitSync: wait failed');
            else if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
                gl.deleteSync(sync);
                resolve(performance.now() - ts);
            }
            else
                setTimeout(loop, 0);
        };
        loop();
    });
}
//# sourceMappingURL=gldraw.js.map