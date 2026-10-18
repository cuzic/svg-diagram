// The measuring settings of a project (ADR 0031 §2): which engine, whether it was chosen, which font files. A shell file: it reads
// SVG_DIAGRAM_MEASURE. The result is a plain value that travels with the diagram (DiagramData.measure).
import type {MeasureSettings} from './types/core.ts';
import type {Config} from './types/project.ts';

/** The engine is `SVG_DIAGRAM_MEASURE` if set, else the config's `measure`; unset everywhere it is 'font' by default (and not `explicit`). */
export function measureSettingsOf(cfg: Pick<Config, 'measure' | 'fonts'>): MeasureSettings {
  const env = process.env.SVG_DIAGRAM_MEASURE || undefined; // empty counts as unset
  if (env && env !== 'chromium' && env !== 'font') throw new Error(`SVG_DIAGRAM_MEASURE=${env}: expected 'chromium' or 'font'`);
  const chosen = (env as 'chromium' | 'font' | undefined) ?? cfg.measure;
  return {backend: chosen ?? 'font', explicit: chosen !== undefined, ...(cfg.fonts ? {fonts: cfg.fonts} : {})};
}
