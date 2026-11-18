type Pt = {
    x: number;
    y: number;
};
interface Sub {
    pts: Pt[];
    closed: boolean;
}
/** null when the path uses something this does not read. */
export declare function parsePath(d: string): Sub[] | null;
/** `svg` is one whole <svg …>…</svg>. Returns HTML: converted boxes plus (only for what could not be converted) small inline SVGs. */
export declare function shapesToCss(svg: string, cls: string): string;
export {};
