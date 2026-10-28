import { type Render } from './markdown-target.ts';
export interface RemarkSvgDiagramOptions {
    /** 'svg' (default) or 'html'. A `#svg` / `#html` on an image's target wins. */
    render?: Render;
    /** Where relative sources are resolved from when the file has no path. */
    baseDir?: string;
    /** Sources must be inside this folder (default: the working folder). */
    root?: string;
    /** true (default): a figure that fails verification or does not load fails the file. false: draw it anyway and add a message. */
    strict?: boolean;
}
interface Node {
    type: string;
    url?: string;
    alt?: string;
    title?: string | null;
    children?: Node[];
    data?: Record<string, unknown>;
}
interface File {
    path?: string;
    data: Record<string, unknown>;
    fail(reason: string, node?: Node): never;
    message(reason: string, node?: Node): unknown;
}
export default function remarkSvgDiagram(opts?: RemarkSvgDiagramOptions): (tree: Node, file: File) => Promise<void>;
export {};
