/* eslint-disable max-classes-per-file */

let gl: WebGL2RenderingContext;

const vertexShaderSrc = `#version 300 es
  precision highp float;
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

const glError = (label: string): boolean => {
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`glError: ${label} ${err}`);
  return err !== gl.NO_ERROR;
};

class GlTextureImpl { // wrapper class for WebGL texture and its utility functions.
  texture: WebGLTexture;
  width: number;
  height: number;

  constructor(texture: WebGLTexture, width: number, height: number) {
    this.texture = texture;
    this.width = width;
    this.height = height;
  }

  bindTexture() {
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }
}

class GlTextureFramebuffer extends GlTextureImpl { // Wrapper class for WebGL texture and its associted framebuffer and utility functions
  framebuffer: WebGLFramebuffer;

  constructor(width: number, height: number) {
    const texture = gl.createTexture();
    if (!texture) throw new Error('createTexture: framebuffer');
    super(texture, width, height);
    this.framebuffer = gl.createFramebuffer() as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    glError('bindFramebuffer');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    glError('createTexture');
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`checkFramebufferStatus: ${status}`);
    const fb = gl.createFramebuffer() as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  }

  bindFramebuffer(): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, this.width, this.height);
  }
}

const compileShader = (type: number, src: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`compileShader: ${type}`);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  const err = gl.getShaderInfoLog(shader);
  if (err) throw new Error(`compileShader: ${err}`);
  return shader;
};

class GlProgramImpl { // Wrapper class for WebGL program and its utility functions
  program: WebGLProgram;
  cachedUniformLocations;

  constructor(vertexSrc: string, fragmentSrc: string) {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSrc);
    glError('compileShader: vertex');
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
    glError('compileShader: fragment');
    this.program = gl.createProgram() as WebGLProgram;
    if (!this.program || !vertexShader || !fragmentShader) throw new Error('createProgram');
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.bindAttribLocation(this.program, 0, 'position');
    gl.bindAttribLocation(this.program, 1, 'input_tex_coord');
    gl.linkProgram(this.program);
    gl.useProgram(this.program);
    glError('createProgram');
    this.cachedUniformLocations = new Map();
  }

  useProgram(): void {
    gl.useProgram(this.program);
  }

  getUniformLocation(symbol: string): WebGLUniformLocation {
    if (this.cachedUniformLocations.has(symbol)) return this.cachedUniformLocations.get(symbol);
    const location = gl.getUniformLocation(this.program, symbol);
    this.cachedUniformLocations.set(symbol, location);
    if (!location) throw new Error(`getUniformLocation: ${symbol}`);
    return location;
  }
}

class FullscreenQuad { // Utility class for drawing
  squareVerticesBuffer: WebGLBuffer;
  textureVerticesBuffer: WebGLBuffer;

  constructor() {
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
    gl.enableVertexAttribArray(0); // vertex
    gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVerticesBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textureVerticesBuffer);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

class GlShaderProcessor { // Utility class for processoring a shader
  quad: FullscreenQuad;
  program: GlProgramImpl;
  frame: GlTextureFramebuffer;

  constructor(shader: string, width: number, height: number) {
    this.quad = new FullscreenQuad();
    this.program = new GlProgramImpl(vertexShaderSrc, shader);
    this.frame = new GlTextureFramebuffer(width, height); // create initial framebuffer
  }

  bindTextures(textures: Array<[name: string, tex: GlTextureImpl]>) {
    let textureId = 0;
    for (const [name, tex] of textures) {
      const loc = this.program.getUniformLocation(name);
      gl.activeTexture(gl.TEXTURE0 + textureId); // Make the textureId unit active.
      tex.bindTexture(); // Binds the texture to a TEXTURE_2D target.
      gl.uniform1i(loc, textureId); // Binds the texture at given location to texture unit textureId.
      textureId++;
    }
  }
}

let processor: GlShaderProcessor;

export function drawTexture(canvas: HTMLCanvasElement, texture: WebGLTexture): void {
  if (gl?.canvas !== canvas) {
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (!gl) throw new Error('getContext: webgl2');
    processor = new GlShaderProcessor(fragmentShaderSrc, canvas.width, canvas.height); // creates new instance of the main class
    gl.viewport(0, 0, processor.frame.width, processor.frame.height); // initial set viewport
    gl.scissor(0, 0, processor.frame.width, processor.frame.height); // initial set scissor
  }
  const mask = new GlTextureImpl(texture, processor.frame.width, processor.frame.height); // create usable texture from tensor data
  processor.program.useProgram(); // switch to this program if something else was using webgl
  processor.bindTextures([['mask', mask]]); // upload texture to gpu
  processor.frame.bindFramebuffer(); // bind to our framebuffer
  processor.quad.draw(); // draw textures using quads
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); // set rendering back to default framebuffer
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, processor.frame.framebuffer); // cache data from result texture drawn in the gl.READ_FRAMEBUFFER
  gl.blitFramebuffer(0, 0, processor.frame.width, processor.frame.height, 0, processor.frame.height, processor.frame.width, 0, gl.COLOR_BUFFER_BIT, gl.LINEAR); // transfer data from read framebuffer to default framebuffer
}
