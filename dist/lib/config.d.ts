import type { Config, DiagramData } from './types.ts';
export declare function loadConfig(from?: string): Config;
export declare function applyConfig<D extends Pick<DiagramData, 'accept' | 'maxWidth'>>(d: D, cfg: Config): D;
