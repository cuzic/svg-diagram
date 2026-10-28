import type { MeasureSettings } from './types/core.ts';
import type { Config } from './types/project.ts';
/** The engine is `SVG_DIAGRAM_MEASURE` if set, else the config's `measure`; unset everywhere it is 'font' by default (and not `explicit`). */
export declare function measureSettingsOf(cfg: Pick<Config, 'measure' | 'fonts'>): MeasureSettings;
