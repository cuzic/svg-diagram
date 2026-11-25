import type { BandDef, WithBandDef } from '../band-def.ts';
import type { EmblemBand, EmblemOpts, EmblemItem, LaidOutFlowShape } from '../flow-shapes.ts';
export declare function emblem(items: string | readonly EmblemItem[], opts?: (Omit<EmblemItem, 'label'> & EmblemOpts)): WithBandDef<EmblemBand, LaidOutFlowShape>;
/** @internal Definition used by the full renderer. */
export declare const emblemDefinition: BandDef<EmblemBand, LaidOutFlowShape>;
