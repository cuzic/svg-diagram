// ADR 0080 spike (round 2): the plugin host as THIN ADAPTERS over today's core. Nothing in lib/ is changed.
// A plugin is plain data + pure functions (PluginDef): it imports nothing from svg-diagram at run time. The CORE side (this file, standing in for
// lib/plugin/) builds the DSL constructors (pluginBands, wrapped in located()), validates, sanitizes with the REAL sanitizeBody, and dispatches.
// A plugin band is lowered to a core `raw` band that carries the envelope {type, data, id}; plugin layout / emit run inside raw's draw(); plugin
// verify runs after the core pipeline and its findings are merged into the verdict. What these adapters CANNOT do is listed in run.ts.
import {raw} from '../../lib/dsl-pure.ts';
import {prefixIds, sanitizeBody} from '../../lib/icon-store.ts';
import {located} from '../../lib/located.ts';
import {PALETTE} from '../../lib/tokens.ts';
import type {Declares} from '../../lib/strict.ts';
import type {RawBand, Finding, LaidOutBand, LaidOutDiagram, Rect, Verdict} from '../../lib/types/index.ts';

export const PLUGIN_API_VERSION = '0.1';

export interface PluginAnchor extends Rect {id: string}
/** The plugin-facing severities (mapped by the host: problem -> verdict problem, warn / info -> findings 'warn' / 'info'). */
export interface PluginFinding {rule: string; severity: 'problem' | 'warn' | 'info'; message: string}
export type Theme = 'blue' | 'teal' | 'amber';
export interface BandEnv {x: number; y: number; w: number; theme: Theme; /** stand-in for roles: the font scale (fill search / canvas) */ scale: number; /** stand-in for the wrap mode (the core falls back from one to the next) */ wrap: 'bunsetsu-soft' | 'phrase'; /** palette hex of a token: recoloured by dark mode */ color(key: 'accent' | 'text' | 'muted' | 'border'): string}
export interface PluginText {x: number; y: number; size: number; text: string}

export interface BandKind<D, L> {
  description: string;
  schema: object;
  example: D;
  build(input: unknown): D;
  /** Pure and idempotent: the core may call it several times per render (fill search, canvas scale, wrap fallback, width 'fit'). */
  layout(data: D, env: BandEnv): {h: number; anchors: PluginAnchor[]; texts?: PluginText[]; paper?: boolean; laid: L};
  /** Shapes only. */
  emit(laid: L, env: BandEnv & {h: number}): string;
  verify?(laid: L, env: BandEnv & {h: number}): PluginFinding[];
  rules?: Record<string, string>;
}
export interface PluginDef {id: string; apiVersion: string; version?: string; bands: Record<string, BandKind<any, any>>}
/** Identity: types only. The object stays plain data. */
export function definePlugin<const P extends PluginDef>(p: P): P { return p; }

export class PluginNotSuppliedError extends Error {}
const apiOk = (v: string): boolean => { const [a, b] = v.split('.'), [A, B] = PLUGIN_API_VERSION.split('.'); return a === A && (a !== '0' ? Number(b) <= Number(B) : b === B); };

/** Per call, never global. */
export class PluginRegistry {
  readonly byId = new Map<string, PluginDef>();
  /** hook call counters, to show hooks run several times per render (idempotence is part of the contract) */
  readonly calls = {layout: 0, emit: 0};
  constructor(plugins: readonly PluginDef[]) {
    for (const p of plugins) {
      if (!/^[a-z][a-z0-9-]*$/.test(p.id)) throw new Error(`plugin id "${p.id}" must be lowercase letters, digits and -`);
      if (!apiOk(p.apiVersion)) throw new Error(`plugin ${p.id}: apiVersion ${p.apiVersion} is not supported by this host (API ${PLUGIN_API_VERSION}; in 0.x the minor must match)`);
      if (this.byId.has(p.id)) throw new Error(`plugin ${p.id} is supplied twice`);
      this.byId.set(p.id, p);
    }
  }
  kind(type: string): {plugin: PluginDef; name: string; kind: BandKind<unknown, unknown>} {
    const [pid, name] = type.split(':');
    const plugin = pid === undefined ? undefined : this.byId.get(pid);
    if (!plugin || name === undefined) throw new PluginNotSuppliedError(`the band type "${type}" is a plugin band, but plugin "${pid}" was not supplied: pass it as diagram({plugins: [...]}) / --plugin / the project config (a spec never loads code). Available: ${[...this.byId.keys()].join(', ') || 'none'}`);
    const kind = plugin.bands[name];
    if (!kind) throw new PluginNotSuppliedError(`plugin ${plugin.id} has no band "${name}" (it has: ${Object.keys(plugin.bands).join(', ')})`);
    return {plugin, name, kind: kind as BandKind<unknown, unknown>};
  }
}

interface Envelope {type: string; data: unknown; id?: string; version?: string}
type Laid = RawBand & {x: number; y: number; w: number; h: number; __plugin: Envelope};
const PROBE_W = 940;
const envOf = (theme: Theme, x: number, y: number, w: number, scale = 1, wrap: BandEnv['wrap'] = 'phrase'): BandEnv => ({x, y, w, theme, scale, wrap, color: k => PALETTE[theme][k as 'accent'] ?? (PALETTE as never as Record<string, string>)[k] as string});

/** #rgb / #rgba / #rrggbb / #rrggbbaa -> rgb() (alpha dropped: a paper band is opaque ink). */
function rgbOfHex(hx: string): string {
  const f = hx.length <= 4 ? [...hx].map(c => c + c).join('') : hx;
  return `rgb(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)})`;
}

/** Host-side gate for a plugin's SVG: the REAL sanitizeBody (allowColor), duplicate ids inside one band, no rgb(); then id prefix; `paper` freezes colours. */
export function sanitizePluginSvg(svg: string, where: string, prefix: string, paper: boolean): string {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`${where}: the id "${dup}" appears twice in one band (scope the ids)`);
  let {body} = sanitizeBody(svg, where, true); // throws on text, style, data-*, rgb(), named colours, outside references ...
  body = prefixIds(body, prefix);
  // paper: like comic, hex -> rgb() AFTER the gate, so dark-mode recolouring (hex for hex) leaves the band alone. Only the values of fill / stroke / stop-color
  // are rewritten (never url(#id) or href), and 3- and 8-digit hex are handled too (sanitizeBody accepts {3,8} digits).
  if (paper) body = body.replace(/(\s(?:fill|stroke|stop-color)=")#([0-9a-fA-F]{3,8})"/g, (_m, pre: string, hx: string) => `${pre}${rgbOfHex(hx)}"`);
  return body;
}

/**
 * Core-side constructor factory (the real one lives in lib/plugin/): for each band kind, a constructor that runs `build`, returns the envelope band,
 * is wrapped in located() (ADR 0072 source positions), and carries Declares<Id> so connect() type-checks.
 */
export function pluginBands<P extends PluginDef>(reg: PluginRegistry, plugin: P): {[K in keyof P['bands'] & string]: <const Id extends string = never>(input: unknown, opts?: {id?: Id; theme?: Theme}) => RawBand & Declares<Id>} {
  const out: Record<string, unknown> = {};
  const supplied = reg.byId.get(plugin.id);
  if (supplied && ((supplied as {version?: string}).version !== (plugin as {version?: string}).version || supplied !== plugin)) throw new Error(`plugin ${plugin.id}: pluginBands() got a different copy / version than diagram({plugins}) (${(plugin as {version?: string}).version ?? '?'} vs ${(supplied as {version?: string}).version ?? '?'}): build the constructors from the object you pass as a plugin`);
  for (const name of Object.keys(plugin.bands)) {
    out[name] = located(<const Id extends string = never>(input: unknown, opts: {id?: Id; theme?: Theme} = {}): RawBand & Declares<Id> => pluginBand(reg, `${plugin.id}:${name}`, input, opts));
  }
  return out as never;
}

/** A prefix that depends only on the band (type, id, data), not on how many bands this process built before (the real host uses the band's position in the diagram). */
const prefixOf = (type: string, id: string | undefined, data: unknown): string => { let x = 2166136261; for (const c of JSON.stringify([type, id, data])) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return `p${(x >>> 0).toString(36)}-`; };
export function pluginBand<const Id extends string = never>(reg: PluginRegistry, type: string, input: unknown, opts: {id?: Id; theme?: Theme} = {}): RawBand & Declares<Id> {
  const {plugin, kind} = reg.kind(type);
  let data: unknown;
  try { data = kind.build(input); } catch (e) { throw new Error(`plugin ${plugin.id}: ${(e as Error).message}`); }
  const theme = opts.theme ?? 'blue';
  reg.calls.layout++;
  const probe = kind.layout(data, envOf(theme, 0, 0, PROBE_W));
  const prefix = prefixOf(type, opts.id, data);
  const band = raw({h: probe.h, draw: ctx => {
    const env = envOf(theme, ctx.x, ctx.y, ctx.w);
    reg.calls.layout++; reg.calls.emit++;
    const {h, laid, paper} = kind.layout(data, env);
    const svg = sanitizePluginSvg(kind.emit(laid, {...env, h}), `plugin ${plugin.id}:${type}`, prefix, !!paper);
    const backing = paper ? `<rect x="${ctx.x}" y="${ctx.y}" width="${ctx.w}" height="${h}" fill="${rgbOfHex(PALETTE.bg.slice(1))}"/>` : '';
    return `<g data-node-host="plugin">${backing}${svg}</g>`; // the host's wrapper (the real one writes data-node itself from `anchors`)
  }}) as Laid;
  band.__plugin = {type, data, version: (plugin as {version?: string}).version, ...(opts.id ? {id: opts.id} : {})};
  if (opts.id) band.id = opts.id;
  return band as RawBand & Declares<Id>;
}

/** Post-layout verify, merged into the verdict. A plugin 'problem' is a verdict problem; an exception inside the plugin is a problem naming the plugin. */
export function withPluginFindings(reg: PluginRegistry, laidOut: LaidOutDiagram, verdict: Verdict, theme: Theme = 'blue'): Verdict {
  const findings: Finding[] = [], problems: string[] = [];
  const put = (plugin: string, rule: string, sev: PluginFinding['severity'], message: string): void => {
    if (sev === 'problem') problems.push(`[${plugin}] ${message} [${plugin}/${rule}]`);
    else findings.push({rule: `${plugin}/${rule}`, severity: sev, message: `[${plugin}] ${message}`});
  };
  for (const b of laidOut.laidOut as LaidOutBand[]) {
    const env = (b as Partial<Laid>).__plugin;
    if (b.type !== 'raw' || !env) continue;
    const {plugin, kind} = reg.kind(env.type);
    try {
      const e = envOf(theme, b.x, b.y, b.w);
      const {h, laid} = kind.layout(env.data, e);
      if (Math.abs(h - b.h) > 0.5) put(plugin.id, 'height-drift', 'warn', `the height reserved at construction (${b.h}) differs from the height at the real width (${h}); a layout hook is needed`);
      for (const f of kind.verify?.(laid, {...e, h}) ?? []) {
        if (!kind.rules?.[f.rule]) put(plugin.id, 'rule-undocumented', 'problem', `the rule "${f.rule}" has no entry in rules`);
        put(plugin.id, f.rule, f.severity, f.message);
      }
    } catch (err) {
      put(plugin.id, 'failed', 'problem', `${env.type} failed: ${(err as Error).message}`);
    }
  }
  return {...verdict, ok: verdict.ok && problems.length === 0, problems: [...verdict.problems, ...problems], findings: [...verdict.findings, ...findings]};
}

/** A spec part `{type: 'rating-demo:stars', ...}` -> a band; only the caller's registry is consulted (the JSON never names code). */
export function buildPluginPart(reg: PluginRegistry, part: {type: string; id?: string} & Record<string, unknown>) {
  const {type, id, ...data} = part;
  return pluginBand(reg, type, data, id === undefined ? {} : {id});
}

const deepFreeze = <T,>(x: T): T => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); } return x; };

/**
 * Prototype of the U6 conformance helper (round 2): layout is run over environments that VARY the width, the font scale and the wrap mode in the order
 * A, B, C, A, B, A (a cache that ignores the environment, or a call-count dependence, shows up as the second A differing from the first), on deep-frozen data
 * (a mutation throws), then emit twice. Returns the failures.
 */
export function conformance(plugin: PluginDef): string[] {
  const bad: string[] = [];
  const reg = new PluginRegistry([plugin]);
  const A = envOf('blue', 0, 0, 940, 1, 'bunsetsu-soft'), B = envOf('blue', 0, 0, 480, 1.25, 'phrase'), C = envOf('blue', 24, 8, 300, 0.875, 'phrase');
  for (const [name, kind] of Object.entries(plugin.bands)) {
    const at = `${plugin.id}:${name}`;
    try {
      const data = deepFreeze(kind.build(structuredClone(kind.example)));
      const j = (r: unknown): string => JSON.stringify(r);
      const fresh = (e: BandEnv) => kind.layout(structuredClone(data), e); // a new object each time: no identity-keyed cache can answer it
      const order = [A, B, C, A, B, A];
      const seq = order.map(e => kind.layout(data, e));
      order.forEach((e, i) => { if (j(seq[i]) !== j(fresh(e))) bad.push(`${at}: layout on the shared data differs from a fresh call for the same environment (call ${i + 1} of ${order.length}): a cache or a call-count dependence`); });
      if (j(seq[0]) !== j(seq[3]) || j(seq[3]) !== j(seq[5])) bad.push(`${at}: layout gives a different result for the same environment after other environments (first A vs later A)`);
      if (j(seq[1]) !== j(seq[4])) bad.push(`${at}: layout gives a different result for the same environment (B vs later B)`);
      const a = seq[0]!;
      structuredClone(a.laid);
      if (new Set(a.anchors.map(x => x.id)).size !== a.anchors.length) bad.push(`${at}: duplicate anchor ids`);
      const svg1 = sanitizePluginSvg(kind.emit(a.laid, {...A, h: a.h}), at, 'x-', false), svg2 = sanitizePluginSvg(kind.emit(a.laid, {...A, h: a.h}), at, 'x-', false);
      if (svg1 !== svg2) bad.push(`${at}: emit is not deterministic`);
      for (const f of kind.verify?.(a.laid, {...A, h: a.h}) ?? []) if (!kind.rules?.[f.rule]) bad.push(`${at}: rule ${f.rule} has no entry in rules`);
      pluginBand(reg, at, kind.example);
    } catch (e) { bad.push(`${at}: ${(e as Error).message}`); }
  }
  return bad;
}
