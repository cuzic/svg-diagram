import type { LoopBackSource } from './loop-back-source.ts';
import type { ConnectBand } from './types/containers.ts';
/** Turn validated loops into connectors, with shorter spans placed nearer their steps. */
export declare function loopBackConnectors(band: {
    id?: string;
}, { loops, anchor }: LoopBackSource, nextId: () => string): ConnectBand[];
