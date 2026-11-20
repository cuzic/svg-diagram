export interface TexSvg {
    /** The drawing: path outlines in MathJax's units, y down, shifted so the formula's box starts at 0,0. */
    inner: string;
    /** The box, in em. */
    w: number;
    h: number;
}
/** The formula as outlines. Throws with MathJax's message when the TeX does not parse. */
export declare function texToSvg(tex: string, display: boolean): TexSvg;
