import type { ResolveHookContext as ResolveContext } from 'node:module';
type ResolveResult = {
    url: string;
    shortCircuit?: boolean;
    format?: string | null | undefined;
    importAttributes?: Record<string, string>;
};
export declare const FRESH_PARAM = "svg-diagram-fresh";
export declare function resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult | Promise<ResolveResult>): Promise<ResolveResult>;
/** The same hook, in-thread. `module.register` starts a loader thread that loads the type stripper again: about two seconds per process, for every CLI run. */
export declare function installResolveHook(): void;
export {};
