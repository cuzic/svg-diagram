import type {BandLayoutHandler} from './layout-ctx.ts';
import type {RevealHandler} from './reveal-handlers.ts';
import type {ToneEnv} from './tokens.ts';
import type {Anchor, ColorKey, FontFamily, FontWeight, Rect, Roles, TextTone, Theme, WidthOf, WrapMode} from './types/core.ts';
import type {Band} from './types/index.ts';
import type {InventoryItem} from './types/inventory.ts';
import type {CheckRect} from './types/verdicts.ts';
import type {VerifyHandler} from './verify-handlers.ts';
import {must} from './must.ts';

export const DEF_API = '0.1';
const DEF_PREFIX = 'svg-diagram.def/';
export const DEF: unique symbol = Symbol.for(`${DEF_PREFIX}${DEF_API}`);

export interface PublicEnv extends Pick<Rect, 'x' | 'y' | 'w'> {
  widthOf: WidthOf;
  roles: Roles;
  theme: Theme;
  tones: ToneEnv;
  wrap: WrapMode;
}

export interface TextItem {
  x: number;
  y: number;
  text: string;
  size: number;
  weight?: FontWeight;
  font?: FontFamily;
  anchor?: 'start' | 'middle' | 'end';
  tone?: TextTone;
  lines?: string[];
  w?: number;
  part?: string;
  reveal?: number;
}

interface MeasureEnv {
  readonly roles: Roles;
  atoms(text: string, size: number, weight: number, font?: FontFamily): void;
}

interface EmitEnv {
  color(key: ColorKey): string;
}

interface VerifyCtx {
  readonly connects: readonly {
    readonly fromId: string;
    readonly toId: string;
    readonly segments: readonly Readonly<Rect>[];
  }[];
}

interface BandFinding {
  rule: string;
  severity: 'problem' | 'warn' | 'info';
  message: string;
  where?: string;
}

interface BandHooks<D, L extends Rect> {
  type: string;
  emit(laid: L, env: EmitEnv): string;
  measure?(data: D, env: MeasureEnv): void;
  verify?: {
    rects?(laid: L): CheckRect[];
    check?(laid: L, ctx: VerifyCtx): BandFinding[];
    contrast?: VerifyHandler<L>['contrast'];
  };
  ids?(data: D): string[];
  reveal?: RevealHandler<D>;
  inventory?(laid: L): InventoryItem[];
  rules?: Record<string, {doc: string; scope: 'band' | 'band-grouped' | 'diagram'}>;
  docs?: {summary: string; usage: string; example: unknown};
  children?(data: D): Band[];
  nodeIds?: 'host' | 'self';
  rectsQualified?: boolean;
  offGrid?: boolean;
}

interface PublicLayout<D, L extends Rect> {
  internal?: never;
  layout(data: D, env: PublicEnv): {h: number; anchors?: Anchor[]; texts?: TextItem[]; paper?: boolean; laid: L};
}

interface InternalLayout<D> {
  internal: true;
  layout(...args: Parameters<BandLayoutHandler<D>>): void;
}

export type BandDef<D = unknown, L extends Rect = Rect> = BandHooks<D, L> & (PublicLayout<D, L> | InternalLayout<D>);
export type BandValue<T extends Band['type']> = Extract<Band, {type: T}> & {readonly [DEF]: BandDef};

export function band<D extends {type: string}, L extends Rect>(def: BandDef<D, L>, data: D): D & {readonly [DEF]: BandDef<D, L>} {
  if (def.type !== data.type) throw new Error(`帯の定義の型 "${def.type}" とデータの型 "${data.type}" が一致しません。同じ型の定義とデータを渡してください`);
  return Object.defineProperty(copyBand(data), DEF, {value: def, enumerable: true, writable: true, configurable: true}) as D & {readonly [DEF]: BandDef<D, L>};
}

export const isDefKey = (key: PropertyKey): boolean => typeof key === 'symbol' && key.description?.startsWith(DEF_PREFIX) === true;

export function defOf(b: object): BandDef | undefined {
  for (const key of Object.getOwnPropertySymbols(b)) {
    if (key !== DEF && isDefKey(key)) {
      throw new Error(`帯の定義の API の版が一致しません（${key.description} と ${DEF.description}）。同じ API 版の入口から帯を作ってください`);
    }
  }
  return (b as {[DEF]?: BandDef})[DEF];
}

/** Copy a band with its prototype, definition and non-enumerable handles. */
export function copyBand<T extends object>(b: T): T {
  return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b)) as T;
}

/**
 * Recursively strip definition keys from arrays and plain objects for comparisons.
 * Other objects are returned by reference. Accessors are preserved without stripping their getter results.
 */
export function plain<T>(v: T): T {
  const seen = new WeakMap<object, object>();
  const strip = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const proto = Object.getPrototypeOf(value);
    const array = Array.isArray(value);
    if (!array && proto !== Object.prototype && proto !== null) return value;

    const previous = seen.get(value);
    if (previous) return previous;
    const out: object = array ? [] : Object.create(proto);
    seen.set(value, out);
    for (const key of Reflect.ownKeys(value)) {
      if (isDefKey(key)) continue;
      const descriptor = must(Object.getOwnPropertyDescriptor(value, key));
      if ('value' in descriptor) descriptor.value = strip(descriptor.value);
      Object.defineProperty(out, key, descriptor);
    }
    return out;
  };
  return strip(v) as T;
}
