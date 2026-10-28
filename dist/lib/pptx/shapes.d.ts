import type { ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutBox } from '../types/text-bands.ts';
import type { FontWeight } from '../types/core.ts';
import { type Rect, type Fonts } from './xml.ts';
/** What `boxXml` reads of a box: a layout box passes as is, a badge or label is built by `plainBox`. */
export type TextBox = Rect & Pick<LaidOutBox, 'tone' | 'dashed' | 'frame' | 'padX' | 'padY' | 'align' | 'wrappedRuns'> & {
    noWrap?: true;
};
/** The text-only box of a badge or label the layout does not carry as a box: one centred run on one line, never wrapped. */
export declare function plainBox(rect: Rect, text: string, o: {
    size: number;
    weight: FontWeight;
    tone: LaidOutBox['tone'];
    frame: boolean;
    padX: number;
    padY: number;
}): TextBox;
export declare function boxXml(id: number, name: string, b: TextBox, day: LaidOutDiagram['day'], tones: ToneEnv, fonts: Fonts): string;
/** The frame of a `group` band: an empty rounded rectangle the boxes inside sit on. */
export declare function groupFrameXml(id: number, name: string, r: Rect, tone: LaidOutBox['tone'], dashed: boolean | undefined, day: LaidOutDiagram['day'], tones: ToneEnv): string;
/** `p:grpSp` whose child coordinate space is the slide's own (chOff = off), so children keep their absolute positions. */
export declare function groupXml(id: number, name: string, r: Rect, inner: string): string;
/** An invisible rectangle standing in for an image band, so connectors can still glue to it. */
export declare function anchorXml(id: number, name: string, r: Rect): string;
/** A PNG picture carrying its SVG twin as `svgBlip` (PowerPoint 2016+ draws the SVG, older readers the PNG). */
export declare function picXml(id: number, name: string, r: Rect, pngRid: string, svgRid: string): string;
