import { type FontBox } from './html-adapter.ts';
/** Turn the generated SVG overlay into positioned HTML text and CSS shapes where possible. */
export declare function renderHtmlOverlay(svg: string, fontBox: FontBox): string;
