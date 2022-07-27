let gl: WebGL2RenderingContext;
let program: WebGLProgram;

const vertexShader = `
  precision mediump float;
  attribute vec2 inPos;
  varying vec2 vertPos;
  void main() {
    vertPos = inPos;
    gl_Position = vec4(inPos, 0.0, 1.0);
  }`;

const fragmentShader = `
  precision mediump float;
  varying vec2 vertPos;
  uniform sampler2D u_texture;
  void main() {
    vec2 texCoord = vec2(vertPos.s, -vertPos.t) * 0.5 + 0.5;
    vec3 texColor = texture2D(u_texture, texCoord.st).rgb;
    gl_FragColor = vec4(texColor.rgb, 1.0);
  }`;

const glCreateProgram = (shaderList: Array<{ source: string, stage: number }>) => {
  const shaderObjs: WebGLShader[] = [];
  for (let i = 0; i < shaderList.length; ++i) {
    const shaderObj = gl.createShader(shaderList[i].stage) as WebGLShader;
    gl.shaderSource(shaderObj, shaderList[i].source);
    gl.compileShader(shaderObj);
    shaderObjs.push(shaderObj);
  }
  const prog = gl.createProgram() as WebGLProgram;
  for (let i = 0; i < shaderObjs.length; ++i) {
    gl.attachShader(prog, shaderObjs[i]);
  }
  gl.linkProgram(prog);
  gl.useProgram(null);
  return prog;
};

export async function loadTexture(url: string): Promise<WebGLTexture> {
  return new Promise((resolve) => {
    const texture = gl.createTexture() as WebGLTexture;
    const image = new Image(0, 0);
    image.onload = () => {
      const tmpCanvas = document.createElement('canvas') as HTMLCanvasElement;
      tmpCanvas.width = image.naturalWidth;
      tmpCanvas.height = image.naturalHeight;
      const context = tmpCanvas.getContext('2d') as CanvasRenderingContext2D;
      context.drawImage(image, 0, 0, tmpCanvas.width, tmpCanvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmpCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_2D, null);
      resolve(texture);
    };
    image.src = url;
  });
}

export async function initScene(canvas: HTMLCanvasElement) {
  const glOptions: WebGLContextAttributes = { alpha: false, antialias: true, depth: false, desynchronized: false, failIfMajorPerformanceCaveat: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
  gl = canvas.getContext('webgl2', glOptions) as WebGL2RenderingContext;
  gl.viewport(0, 0, canvas.width, canvas.height);
  program = glCreateProgram([{ source: vertexShader, stage: gl.VERTEX_SHADER }, { source: fragmentShader, stage: gl.FRAGMENT_SHADER }]);
  gl.useProgram(program);
  const bufRect = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufRect);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
}

export async function drawTexture(textureObj: WebGLTexture) {
  if (!gl || !program) return;
  const textureLoc = gl.getUniformLocation(program, 'u_texture') as WebGLUniformLocation;
  // gl.disable(gl.DEPTH_TEST);
  gl.activeTexture(gl.TEXTURE0 + 1);
  gl.bindTexture(gl.TEXTURE_2D, textureObj);
  gl.uniform1i(textureLoc, 1);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  gl.disableVertexAttribArray(0);
  // gl.clear(gl.DEPTH_BUFFER_BIT);
  // gl.enable(gl.DEPTH_TEST);
}
