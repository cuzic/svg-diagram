import {BandError} from './band-error.ts';
import type {resolveConnect} from './layout-connect.ts';
import type {BandLayoutHandler} from './layout-ctx.ts';
import type {RevealHandler} from './reveal-handlers.ts';
import type {ToneEnv} from './tokens.ts';
import type {Anchor, ColorKey, FontFamily, FontWeight, Rect, RevealOpts, Roles, ScopeOpts, TextTone, Theme, WidthOf, WrapMode} from './types/core.ts';
import type {Band} from './types/index.ts';
import type {InventoryItem} from './types/inventory.ts';
import type {CheckRect} from './types/verdicts.ts';
import type {VerifyHandler} from './verify-handlers.ts';
import {must} from './must.ts';

export const DEF_API = '0.1';
const DEF_PREFIX = 'svg-diagram.def/';
export const DEF: unique symbol = Symbol.for(`${DEF_PREFIX}${DEF_API}`);
export const EXTERNAL: unique symbol = Symbol.for('svg-diagram.external');

export interface PublicEnv extends Pick<Rect, 'x' | 'y' | 'w'> {
  widthOf: WidthOf;
  roles: Roles;
  theme: Theme;
  tones: ToneEnv;
  wrap: WrapMode;
  today?: string;
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
  readonly today?: string;
  atoms(text: string, size: number, weight: number, font?: FontFamily): void;
}

interface EmitEnv {
  readonly stage?: number;
  readonly theme: Theme;
  readonly roles: Roles;
  readonly tones: ToneEnv;
  color(key: ColorKey): string;
}

interface VerifyCtx {
  readonly theme: Theme;
  readonly tones: ToneEnv;
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

interface BandHooks<D, L extends object> {
  type: string;
  readonly [EXTERNAL]?: true;
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
  generated?(data: D): Band[];
  stackWidth?(data: D, width: number): number;
  nodeIds?: 'host' | 'self';
  rectsQualified?: boolean;
  offGrid?: boolean;
}

interface PublicLayout<D, L extends object> {
  internal?: never;
  layout(data: D, env: PublicEnv): {h: number; anchors?: Anchor[]; texts?: TextItem[]; paper?: boolean; laid: L & Rect};
}

interface InternalLayout<D> {
  internal: true;
  outputTypes?: readonly string[];
  resolveConnect?: typeof resolveConnect;
  expandLoopBacks?: (bands: Band[]) => Band[];
  layout(...args: Parameters<BandLayoutHandler<D>>): void;
}

export type BandDef<D = unknown, L extends object = Rect> = BandHooks<D, L> & (PublicLayout<D, L> | InternalLayout<D>);
type ExternalType = `${string}:${string}`;
type ExternalBand<T> = T extends ExternalType ? {type: T; id?: string} & ScopeOpts & RevealOpts : never;

export type BandValue<T extends Band['type'] | ExternalType> =
  (Extract<Band, {type: T}> | ExternalBand<T>) & {readonly [DEF]: BandDef};

export function assertTrustedBandFields(def: Pick<BandDef, 'type' | 'internal' | 'nodeIds' | 'rectsQualified' | typeof EXTERNAL>): void {
  const separator = def.type.indexOf(':');
  if (!def[EXTERNAL] && separator < 0) return;
  const field = def.internal === true ? 'internal'
    : def.nodeIds === 'self' ? 'nodeIds'
    : def.rectsQualified === true ? 'rectsQualified' : undefined;
  if (field) {
    const plugin = separator < 0 ? def.type : def.type.slice(0, separator);
    const kind = separator < 0 ? def.type : def.type.slice(separator + 1);
    throw new BandError(plugin, kind, 'definition', `外部の帯の定義では ${field} を使えません。定義から削除してください`);
  }
}

export type WithBandDef<D, L extends object> = D & {readonly [DEF]: BandDef<D, L>};

export function band<D extends {type: string}, L extends object>(def: BandDef<D, L>, data: D): WithBandDef<D, L> {
  if (def.type !== data.type) throw new Error(`帯の定義の型 "${def.type}" とデータの型 "${data.type}" が一致しません。同じ型の定義とデータを渡してください`);
  assertTrustedBandFields(def);
  return Object.defineProperty(copyBand(data), DEF, {value: def, enumerable: true, writable: true, configurable: true}) as WithBandDef<D, L>;
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
