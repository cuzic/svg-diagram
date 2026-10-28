import type { ConnectBand, ConnectOpts } from '../types/containers.ts';
import type { ConnectDefaults } from '../types/core.ts';
import type { Band } from '../types/index.ts';
export declare const GIVEN: unique symbol;
export declare function applyConnectDefaults(bands: Band[], defaults: ConnectDefaults): Band[];
export declare function connectBand(from: string, to: string, opts: ConnectOpts, trackGiven?: boolean): ConnectBand;
