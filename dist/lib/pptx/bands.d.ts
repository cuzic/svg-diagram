import type { LaidOutOf } from '../band-table.ts';
import type { LaidOutDiagram, LaidOutBand } from '../types/index.ts';
import type { Rect, Fonts } from './xml.ts';
import type { ToneEnv } from '../tokens.ts';
import { type TextBox } from './shapes.ts';
import { type Picture } from './image-band.ts';
/** What the bands of one slide share: ids, the shapes connectors can glue to, and the pictures to rasterize. */
export interface Ctx {
    ld: LaidOutDiagram;
    /** The diagram's tone overrides (planSlide resolves them once from ld.tones). */
    tones: ToneEnv;
    fonts: Fonts;
    next(): number;
    glue: Map<string, {
        id: number;
        rect: Rect;
    }>;
    pictures: Picture[];
}
type BandXml<B> = (band: B, ctx: Ctx, index: number) => string;
/** A box or banner, with the parts a box may carry beside its frame. */
type BoxLike = TextBox & Pick<LaidOutOf<'box'>, 'id' | 'tag' | 'tagBox' | 'stamp' | 'stampW' | 'step' | 'icon'>;
declare const boxBand: (b: BoxLike, ctx: Ctx) => string;
/** One disposition per laid-out band type; a missing band type fails compilation. */
export declare const BAND_HANDLERS: {
    caption: BandXml<import("../types/text-bands.ts").LaidOutCaption & import("../types/core.ts").Dimmed>;
    box: typeof boxBand;
    banner: typeof boxBand;
    group: BandXml<import("../types/containers.ts").LaidOutGroup & import("../types/core.ts").Dimmed>;
    row: BandXml<import("../types/containers.ts").LaidOutRow & import("../types/core.ts").Dimmed>;
    grid: BandXml<import("../types/containers.ts").LaidOutGrid & import("../types/core.ts").Dimmed>;
    table: BandXml<import("../types/sequence-table-swimlane.ts").LaidOutTable & import("../types/core.ts").Dimmed>;
    legend: "image";
    swimlane: "image";
    wireframe: "image";
    screens: "image";
    sequence: "image";
    raw: "image";
    pyramid: "image";
    curve: "image";
    plane: "image";
    quadrant: "image";
    wordart: "image";
    chevron: "image";
    funnel: "image";
    cycle: "image";
    venn: "image";
    concentric: "image";
    emblem: "image";
    bars: "image";
    chart: "image";
    image: "image";
    people: "image";
    dots: "image";
    math: "image";
    timeline: "image";
    tree: "image";
    states: "image";
    cause: "image";
    cloud: "image";
    gantt: "image";
    classes: "image";
    bpmn: "image";
    fta: "image";
    status: "image";
    bowtie: "image";
};
export declare function bandXml(band: LaidOutBand, ctx: Ctx, index: number): string;
export {};
