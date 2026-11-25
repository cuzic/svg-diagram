import type { SpotlightHooks } from './band-def.ts';
import type { LaidOutStatus, StatusBand } from './types/containers.ts';
/**
 * The status badge (diagram({status})): one accessible unit, a dashed outline (not colour alone says "draft"), bold text. Colours are
 * tokens, so appearance: 'dark' recolours it like everything else; `danger` is not used (it means "an example not to follow").
 */
export declare function renderStatus(band: LaidOutStatus): string;
export declare const statusSpotlight: SpotlightHooks<StatusBand, LaidOutStatus>;
