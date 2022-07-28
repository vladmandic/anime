/* eslint-disable max-classes-per-file */

const vertexShaderSrc = `#version 300 es
  precision mediump float;
  in vec4 position;
  in vec4 input_tex_coord;
  out vec2 tex_coord;
  void main() {
    gl_Position = position;
    tex_coord = input_tex_coord.xy;
  }`;

const fragmentShaderSrc = `#version 300 es
precision mediump float;
uniform sampler2D mask;
in highp vec2 tex_coord;
out vec4 out_color;
void main() {
  vec2 coord = vec2(tex_coord[0], tex_coord[1]);
  vec4 color = texture(mask, coord).rgba;
  out_color = vec4(color.rgba);
}`;

const glError = (gl: WebGL2RenderingContext, label: string): boolean => {
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`glError: ${label} ${err}`);
  return err !== gl.NO_ERROR;
};

class GLTexture { // wrapper class for WebGL texture and its utility functions.
  texture: WebGLTexture;
  width: number;
  height: number;
  gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, texture: WebGLTexture, width: number, height: number) {
    this.gl = gl;
    this.texture = texture;
    this.width = width;
    this.height = height;
  }

  bindTexture() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }
}

class GLFrameBuffer extends GLTexture { // Wrapper class for WebGL texture and its associted framebuffer and utility functions
  framebuffer: WebGLFramebuffer;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    const texture = gl.createTexture();
    if (!texture) throw new Error('createTexture: framebuffer');
    super(gl, texture, width, height);
    this.gl = gl;
    this.framebuffer = gl.createFramebuffer() as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    glError(gl, 'bindFramebuffer');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    glError(gl, 'createTexture');
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`checkFramebufferStatus: ${status}`);
    const fb = gl.createFramebuffer() as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  }

  bindFramebuffer(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.width, this.height);
  }
}

const compileShader = (gl: WebGL2RenderingContext, type: number, src: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`compileShader: ${type}`);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  const err = gl.getShaderInfoLog(shader);
  if (err) throw new Error(`compileShader: ${err}`);
  return shader;
};

class GLProgram { // Wrapper class for WebGL program and its utility functions
  program: WebGLProgram;
  cachedUniformLocations;
  gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string) {
    this.gl = gl;
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
    glError(gl, 'compileShader: vertex');
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
    glError(gl, 'compileShader: fragment');
    this.program = gl.createProgram() as WebGLProgram;
    if (!this.program || !vertexShader || !fragmentShader) throw new Error('createProgram');
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.bindAttribLocation(this.program, 0, 'position');
    gl.bindAttribLocation(this.program, 1, 'input_tex_coord');
    gl.linkProgram(this.program);
    gl.useProgram(this.program);
    glError(gl, 'createProgram');
    this.cachedUniformLocations = new Map();
  }

  useProgram(): void {
    this.gl.useProgram(this.program);
  }

  getUniformLocation(symbol: string): WebGLUniformLocation {
    if (this.cachedUniformLocations.has(symbol)) return this.cachedUniformLocations.get(symbol);
    const location = this.gl.getUniformLocation(this.program, symbol);
    this.cachedUniformLocations.set(symbol, location);
    if (!location) throw new Error(`getUniformLocation: ${symbol}`);
    return location;
  }
}

class FullscreenQuad { // Utility class for drawing
  squareVerticesBuffer: WebGLBuffer;
  textureVerticesBuffer: WebGLBuffer;
  gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.squareVerticesBuffer = gl.createBuffer() as WebGLBuffer;
    if (!this.squareVerticesBuffer) throw new Error('squareVerticesBuffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.textureVerticesBuffer = gl.createBuffer() as WebGLBuffer;
    if (!this.textureVerticesBuffer) throw new Error('textureVerticesBuffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }

  draw(): void { // Draws a quad covering the entire bound framebuffer.
    this.gl.enableVertexAttribArray(0); // vertex
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.squareVerticesBuffer);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(1);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureVerticesBuffer);
    this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}

class GLProcessor { // Utility class for processoring a shader
  quad: FullscreenQuad;
  program: GLProgram;
  frame: GLFrameBuffer;
  gl: WebGL2RenderingContext;

  constructor(glContext: WebGL2RenderingContext, shaderSrc: string, canvas: HTMLCanvasElement) {
    this.gl = glContext;
    this.gl.viewport(0, 0, canvas.width, canvas.height); // initial set viewport
    this.gl.scissor(0, 0, canvas.width, canvas.height); // initial set scissor
    this.quad = new FullscreenQuad(this.gl);
    this.program = new GLProgram(this.gl, vertexShaderSrc, shaderSrc);
    this.frame = new GLFrameBuffer(this.gl, canvas.width, canvas.height); // create initial framebuffer
  }

  bindTextures(textures: Array<[name: string, texure: GLTexture]>) {
    let textureId = 0;
    for (const [name, texture] of textures) {
      const loc = this.program.getUniformLocation(name);
      this.gl.activeTexture(this.gl.TEXTURE0 + textureId); // Make the textureId unit active.
      texture.bindTexture(); // Binds the texture to a TEXTURE_2D target.
      this.gl.uniform1i(loc, textureId); // Binds the texture at given location to texture unit textureId.
      textureId++;
    }
  }

  flipFramebuffers() {
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null); // set rendering back to default framebuffer
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, this.frame.framebuffer); // cache data from result texture drawn in the gl.READ_FRAMEBUFFER
    this.gl.blitFramebuffer(0, 0, this.frame.width, this.frame.height, 0, this.frame.height, this.frame.width, 0, this.gl.COLOR_BUFFER_BIT, this.gl.LINEAR); // transfer data from read framebuffer to default framebuffer
  }
}

let processor: GLProcessor;

export function drawTexture(canvas: HTMLCanvasElement, texture: WebGLTexture): void {
  if (processor?.gl?.canvas !== canvas) {
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (!gl) throw new Error('getContext: webgl2');
    processor = new GLProcessor(gl, fragmentShaderSrc, canvas); // creates new instance of the main class
  }
  const mask = new GLTexture(processor.gl, texture, processor.frame.width, processor.frame.height); // create usable texture from tensor data
  processor.program.useProgram(); // switch to this program if something else was using webgl
  processor.bindTextures([['mask', mask]]); // upload texture to gpu
  processor.frame.bindFramebuffer(); // bind to our framebuffer
  processor.quad.draw(); // draw textures using quads
  processor.flipFramebuffers(); // flip read framebuffer to draw framebuffer
}
