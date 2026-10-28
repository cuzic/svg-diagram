import type { ToneEnv } from './tokens.ts';
import type { LaidOutBars } from './types/bars.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutTree, LaidOutStates, LaidOutCause, LaidOutCloud, LaidOutClasses, LaidOutBpmn } from './types/diagrams.ts';
import type { LaidOutMath } from './types/math.ts';
import type { LaidOutPlane } from './types/figures.ts';
import type { LaidOutImage } from './types/image.ts';
import type { LaidOutTimeline, LaidOutGantt } from './types/timeline.ts';
import type { LaidOutQuadrant } from './quadrant.ts';
import type { LaidOutFlowShape } from './flow-shapes.ts';
export declare function renderPlane(b: LaidOutPlane, day: Theme, tones: ToneEnv, stage?: number): string;
export declare function renderBars(b: LaidOutBars, day: Theme, stage?: number, dimFill?: boolean): string;
export declare function renderImage(b: LaidOutImage, day: Theme, tones: ToneEnv, stage?: number): string;
export declare function renderQuadrant(b: LaidOutQuadrant, day: Theme, tones: ToneEnv): string;
/**
 * A flow shape (chevron / funnel / cycle / venn / concentric / emblem) dims ITSELF when its band is out of the spotlight: the outline, the text
 * and the arrows turn muted and an opaque fill turns white. (renderBand used to recolour every fill of a dimmed band to muted, which made a
 * filled shape and its muted text the same colour: the text vanished and the lint stopped the build.)
 */
export declare function renderFlowShape(b: LaidOutFlowShape, day: Theme, tones: ToneEnv): string;
export declare function renderTimeline(b: LaidOutTimeline, day: Theme): string;
export declare function renderTree(b: LaidOutTree, day: Theme, tones: ToneEnv): string;
export declare function renderStates(b: LaidOutStates, day: Theme, tones: ToneEnv): string;
export declare function renderCause(b: LaidOutCause, day: Theme, tones: ToneEnv): string;
export declare function renderCloud(b: LaidOutCloud, day: Theme, tones: ToneEnv): string;
export declare function renderGantt(b: LaidOutGantt, day: Theme): string;
export declare function renderClasses(b: LaidOutClasses, day: Theme, tones: ToneEnv): string;
export declare function renderBpmn(b: LaidOutBpmn, day: Theme, tones: ToneEnv): string;
export declare function renderMath(band: LaidOutMath): string;
