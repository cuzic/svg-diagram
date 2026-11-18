import { type Render } from './markdown-target.ts';
export interface SvgDiagramPluginOptions {
    /** 'svg' (default) or 'html'. A `#svg` / `#html` on an image's target wins. */
    render?: Render;
    /** Where relative sources are resolved from when the page's own path is unknown. */
    baseDir?: string;
    /** Sources must be inside this folder (default: the working folder). */
    root?: string;
    /** true (default): a figure that fails verification or does not load throws, so the build stops. false: draw it anyway / show the error in the page. */
    strict?: boolean;
    /** Milliseconds a figure may take to draw (default 120000). */
    timeout?: number;
    /** Emit each figure as the value of a Vue `v-html` (VitePress sets this): a Vue template would read `{{ }}` in it and drop its <style>. */
    vue?: boolean;
}
interface MdLike {
    renderer: {
        rules: {
            image?: (tokens: any[], idx: number, options: any, env: any, self: any) => string;
        };
    };
    core: {
        ruler: {
            after(after: string, name: string, fn: (state: any) => void): void;
        };
    };
}
export default function svgDiagram(md: MdLike, opts?: SvgDiagramPluginOptions): void;
export {};
