export declare class BandError extends Error {
    readonly plugin: string;
    readonly kind: string;
    readonly phase: 'definition' | 'build' | 'layout';
    constructor(plugin: string, kind: string, phase: BandError['phase'], message: string, options?: ErrorOptions);
}
