import type {LaidOutOf, LaidOutType} from '../band-table.ts';
import type {LaidOutBand, LaidOutDiagram} from '../types/index.ts';
import type {ToneEnv} from '../tokens.ts';
import type {Picture} from './image-band.ts';
import type {Fonts, Rect} from './xml.ts';

/** What the bands of one slide share: ids, the shapes connectors can glue to, and the pictures to rasterize. */
export interface Ctx {
  ld: LaidOutDiagram;
  /** The diagram's tone overrides (planSlide resolves them once from ld.tones). */
  tones: ToneEnv;
  fonts: Fonts;
  stage?: number;
  next(): number;
  glue: Map<string, {id: number; rect: Rect}>;
  pictures: Picture[];
  /** How many bands of each type have been named (bandName). */
  count: Map<string, number>;
}
export type BandXml<B> = (band: B, ctx: Ctx, index: number) => string;
export type PptxAdapter<B> = (band: B, ctx: Ctx, index: number) => string | undefined;
export type PptxBands = {[T in LaidOutType]?: PptxAdapter<LaidOutOf<T>>};

/** Remember a DSL id so connectors can glue to this shape. */
export const register = (ctx: Ctx, dslId: string | undefined, id: number, rect: Rect): void => {
  if (dslId) ctx.glue.set(dslId, {id, rect});
};

export interface SpanEnv {
  readonly ctx: Ctx;
  readonly index: number;
  readonly following: readonly LaidOutBand[];
  drawBand(): string;
  drawChildren(count: number, nested: boolean): string;
}

export type PlanSpan<B> = (band: B, env: SpanEnv) => {xml: string; count: number} | undefined;
export type PptxSpans = {[T in LaidOutType]?: PlanSpan<LaidOutOf<T>>};
