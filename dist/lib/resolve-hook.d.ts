import type { ResolveHookContext as ResolveContext } from 'node:module';
type ResolveResult = {
    url: string;
    shortCircuit?: boolean;
    format?: string | null | undefined;
    importAttributes?: Record<string, string>;
};
export declare function resolve(specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => ResolveResult | Promise<ResolveResult>): Promise<ResolveResult>;
export {};
