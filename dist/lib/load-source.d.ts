import type { Diagram } from './types/core.ts';
import type { Config } from './types/project.ts';
/** `abs`'s default export, or an error that says what a source should export. */
export declare function importDefine(abs: string, opts?: {
    fresh?: boolean;
}): Promise<() => Diagram>;
/** Import `abs`, run its define(), and apply the project's .svg-diagram.json (accepted rules, max width). */
export declare function loadDiagram(abs: string, config?: Config, opts?: {
    fresh?: boolean;
}): Promise<Diagram>;
