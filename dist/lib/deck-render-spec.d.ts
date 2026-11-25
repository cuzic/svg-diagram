import type { Config } from './types/project.ts';
import type { RenderResult } from './types/verdicts.ts';
export declare function renderDeckSpec(spec: unknown, cfg: Config): Promise<RenderResult | undefined>;
