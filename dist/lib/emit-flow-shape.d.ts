import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutFlowShape } from './flow-shapes.ts';
/**
 * A flow shape (chevron / funnel / cycle / venn / concentric / emblem) dims ITSELF when its band is out of the spotlight: the outline, the text
 * and the arrows turn muted and an opaque fill turns white. (renderBand used to recolour every fill of a dimmed band to muted, which made a
 * filled shape and its muted text the same colour: the text vanished and the lint stopped the build.)
 */
export declare function renderFlowShape(b: LaidOutFlowShape, day: Theme, tones: ToneEnv): string;
export declare const flowSpotlight: SpotlightHooks<never, LaidOutFlowShape>;
