import type { Config, Diagram } from './types.ts';
/** `abs`'s default export, or an error that says what a source should export. */
export declare function importDefine(abs: string): Promise<() => Diagram>;
/** Import `abs`, run its define(), and apply the project's .svg-diagram.json (accepted rules, max width). */
export declare function loadDiagram(abs: string, config?: Config): Promise<Diagram>;
