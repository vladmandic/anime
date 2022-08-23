/** TFJS custom backend registration */
export declare const config: {
    name: string;
    priority: number;
    canvas: HTMLCanvasElement | null;
    gl: WebGL2RenderingContext | null;
    extensions: string[];
    webGLattr: {
        alpha: boolean;
        antialias: boolean;
        premultipliedAlpha: boolean;
        preserveDrawingBuffer: boolean;
        depth: boolean;
        stencil: boolean;
        failIfMajorPerformanceCaveat: boolean;
        desynchronized: boolean;
    };
};
export declare function registerWebGLbackend(canvas: HTMLCanvasElement): Promise<WebGL2RenderingContext | null>;
//# sourceMappingURL=glbackend.d.ts.map