// ADR 0080 spike (round 3): ONE band-definition interface for core and plugin bands, and dispatch THROUGH THE BAND VALUE.
// A band value is {def, data, id?}. The pipeline never looks a band up in a central table: it calls band.def.<hook>. A band that is never
// imported is never bundled, and nothing registers anything. (Prototype: reduced hooks; the real BandDef has the hooks of ADR 0080 D2.)
import type {FontFamily, Rect, Roles, WidthOf} from '../../../lib/types/core.ts';

export interface MeasureCtx {readonly roles: Roles; atoms(text: string, size: number, weight: number, font?: FontFamily): void}
export interface LayoutEnv {x: number; y: number; w: number; roles: Roles; widthOf: WidthOf}
export interface EmitEnv {roles: Roles}
export interface Anchor extends Rect {id: string}

/** D = the band's data (what its constructor built), L = its laid-out form (plain JSON). Every hook is pure. */
export interface BandDef<D, L extends Rect> {
  /** 'box' for a core band, 'manga-face:avatar' for a plugin: the only difference is the namespace. */
  readonly type: string;
  measure?(data: D, m: MeasureCtx): void;
  layout(data: D, env: LayoutEnv): {laid: L; h: number; anchors?: Anchor[]};
  emit(laid: L, env: EmitEnv): string;
  verify?(laid: L): {rule: string; severity: 'problem' | 'warn' | 'info'; message: string}[];
}
/** The value a DSL constructor returns: it carries its definition. */
export interface BandValue<D = unknown, L extends Rect = Rect> {readonly def: BandDef<D, L>; readonly data: D; readonly id?: string}

export const defineBand = <D, L extends Rect>(def: BandDef<D, L>): BandDef<D, L> => def;
export const band = <D, L extends Rect>(def: BandDef<D, L>, data: D, id?: string): BandValue<D, L> => ({def, data, ...(id === undefined ? {} : {id})});
