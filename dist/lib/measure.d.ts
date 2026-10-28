import type { Browser } from 'playwright-chromium';
import type { Raster } from './raster.ts';
import { splitAtoms, textWidth } from './atoms.ts';
import type { FontFamily, MeasureRequest, MeasureSettings, Measured } from './types/core.ts';
import type { Config } from './types/project.ts';
export { splitAtoms, textWidth };
declare function getBrowser(): Promise<Browser>;
export { getBrowser };
/**
 * Draw `svg` the way a page's <img src="x.svg"> does — as an image document, parsed as XML, with this browser's fonts —
 * scaled by `scale`, on white. An SVG that is not well-formed XML fails to load as an <img>; that is reported here as an
 * error rather than drawn from a forgiving HTML parse. Reuses the measuring browser, so a .ts source costs no extra launch.
 */
export declare function rasterizeInBrowser(svg: string, { scale, png }?: {
    scale?: number;
    png?: boolean;
}): Promise<Raster>;
export declare function closeMeasurer(): Promise<void>;
/** Set the process default settings: what a measurement without settings of its own uses (the CLIs, tests). */
export declare function configureMeasure(cfg: Pick<Config, 'measure' | 'fonts'>): void;
/** The process default settings (read from the cwd's config the first time). */
export declare function defaultMeasureSettings(): MeasureSettings;
/** Which engine measures by default now, and whether the person chose it (`measure` / SVG_DIAGRAM_MEASURE) rather than it being the default. */
export declare function currentMeasure(): {
    backend: 'chromium' | 'font';
    explicit: boolean;
};
export declare function measureAll(requests: Map<string, MeasureRequest>, settings?: MeasureSettings): Promise<Map<string, Measured>>;
export declare function measureAtoms(strings: Iterable<string>, { size, weight, font }: {
    size: number;
    weight?: number;
    font?: FontFamily;
}): Promise<{
    width: (atom: string) => number;
    height: (atom: string) => number;
    raw: Map<string, Measured>;
}>;
