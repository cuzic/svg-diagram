import type { DiagramData } from './types/core.ts';
import type { Config, FontSpecs } from './types/project.ts';
export declare function loadConfig(from?: string): Config;
/** One .svg-diagram.json, read and checked (`--config <path>` names it directly). */
export declare function readConfigFile(f: string): Config;
/** `fonts` paths are relative to the config file's folder (like `outDir`), not to where the command was run: the same file works from any directory. `path#N` keeps its face index. */
export declare function resolveFonts(fonts: FontSpecs, dir: string): FontSpecs;
export declare function applyConfig<D extends Pick<DiagramData, 'today' | 'accept' | 'terms' | 'maxWidth' | 'legend' | 'legendLabels' | 'tones' | 'canvas' | 'keepWords' | 'wrap' | 'measure'>>(d: D, cfg: Config): D;
/** The folder the project's SVGs live in: `outDir` of .svg-diagram.json (relative to that file), else ./svg. Relative to the working directory when it lies below it. */
export declare function svgDirOf(cfg: Config, cwd?: string): string;
