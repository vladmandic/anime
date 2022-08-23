declare type TextureOptions = {
    format: 'rgb' | 'rgba';
};
declare class GLTexture {
    texture: WebGLTexture;
    width: number;
    height: number;
    gl: WebGL2RenderingContext;
    constructor(gl: WebGL2RenderingContext, texture: WebGLTexture, width: number, height: number);
    bindTexture(): void;
}
declare class GLFrameBuffer extends GLTexture {
    framebuffer: WebGLFramebuffer;
    format: string;
    constructor(gl: WebGL2RenderingContext, width: number, height: number, options: TextureOptions);
    bindFramebuffer(): void;
}
declare class GLProgram {
    program: WebGLProgram;
    cachedUniformLocations: any;
    gl: WebGL2RenderingContext;
    constructor(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string);
    useProgram(): void;
    getUniformLocation(symbol: string): WebGLUniformLocation;
}
declare class GLProcessor {
    program: GLProgram;
    frame: GLFrameBuffer;
    gl: WebGL2RenderingContext;
    options: TextureOptions;
    squareVerticesBuffer: WebGLBuffer;
    textureVerticesBuffer: WebGLBuffer;
    vertexShaderSrc: string;
    fragmentShaderSrc: string;
    constructor(gl: WebGL2RenderingContext, options: TextureOptions);
    bindTextures(textures: Array<[name: string, texure: GLTexture]>): void;
    flipFramebuffers(): void;
    drawVertices(): void;
}
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
export declare function drawTexture(canvas: HTMLCanvasElement, texture: WebGLTexture, options?: TextureOptions): GLProcessor;
/**
 * Wait for completion of any pending GL commands
 * This is a standalone function  and can be used with a default WebGL backend
 * Example: `await syncWait(tf.backend().getGPGPUContext().gl);`
 * @param canvas HTMLCanvasElement for which WebGL2 context we'll wait for GL command completion
 * @returns number how long the synchronization took in ms
 */
export declare function syncWait(gl: WebGL2RenderingContext): Promise<number>;
export {};
//# sourceMappingURL=gldraw.d.ts.map