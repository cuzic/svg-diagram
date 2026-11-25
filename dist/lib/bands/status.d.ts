import type { BandDef, WithBandDef } from '../band-def.ts';
import type { LaidOutStatus, StatusBand } from '../types/containers.ts';
import type { DiagramStatus } from '../types/core.ts';
import type { Finding } from '../types/verdicts.ts';
/** @internal Shared wording for the diagram-level finding. */
export declare function draftStatusFinding(status: DiagramStatus): Finding;
/** A status strip. Put it first to place the badge above the content. */
export declare function status(value: DiagramStatus, label?: string): WithBandDef<StatusBand, LaidOutStatus>;
/** @internal Definition used by the full renderer. */
export declare const statusDefinition: BandDef<StatusBand, LaidOutStatus>;
