import { prepareBands } from './core.ts';
import type { FontBox, HtmlAdapters } from './html-adapter.ts';
export type { FontBox, HtmlBandAdapter } from './html-adapter.ts';
type HtmlOptions = Parameters<typeof prepareBands>[1] & {
    fontBox: FontBox;
    adapters?: HtmlAdapters;
    overlay?: (svg: string, fontBox: FontBox) => string;
    id?: string;
    strict?: boolean;
};
/** Render selected bands to HTML, reporting the parts embedded as SVG. */
export declare function renderBandsHtml(bands: Parameters<typeof prepareBands>[0], opts: HtmlOptions): Promise<{
    html: string;
    width: number;
    height: number;
    fallbacks: {
        type: string;
        id?: string;
    }[];
    verdict: import("./types/verdicts.ts").Verdict;
}>;
