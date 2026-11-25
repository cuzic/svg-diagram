import type { RevealStage } from './reveal-warnings.ts';
import type { GroupRowBand, RowBand } from './types/containers.ts';
type Row = RowBand | GroupRowBand;
/** A slot appears with its latest child and vanishes when all its children have vanished. */
export declare function rowSlotStages({ id, cols, children }: Row): Map<string, RevealStage>;
export {};
