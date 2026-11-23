// ADR 0080 spike: the plugin host as THIN ADAPTERS over today's core. Nothing in lib/ is changed.
// A plugin band is lowered to a core `raw` band (the one band type that accepts foreign drawing code) that carries the plugin envelope
// {plugin, kind, data}. Plugin layout / emit run inside raw's draw(); plugin verify runs after the core pipeline on the laid-out
// raw bands and its findings are merged into the verdict. What the adapters CANNOT do is the measurement of this spike (see run.ts).
import {raw} from '../../lib/dsl-pure.ts';
import type {Declares} from '../../lib/strict.ts';
import type {RawBand, Finding, LaidOutBand, LaidOutDiagram, Rect, Verdict} from '../../lib/types/index.ts';

export const PLUGIN_API_VERSION = '1.0.0';

export interface PluginAnchor extends Rect {id: string}
export interface PluginFinding {rule: string; severity: 'problem' | 'warning' | 'advice'; message: string}
export interface BandEnv {x: number; y: number; w: number; theme: 'blue' | 'teal' | 'amber'}

/** One band kind a plugin adds. D = the data (validated by build), L = what layout returns (plain JSON, so emit / verify stay pure). */
export interface BandKind<D, L> {
  description: string;
  /** JSON Schema fragment of the data (the spec's `{type: 'plugin-id:kind', ...data}`). */
  schema: object;
  example: D;
  /** Throws a message naming the field. The only place a constructor / spec input is checked. */
  build(input: unknown): D;
  /** Pure: no clock, no random, no I/O. `h` and `anchors` are what the core needs (cursor, connect() targets). */
  layout(data: D, env: BandEnv): {h: number; anchors: PluginAnchor[]; laid: L};
  /** Pure: an SVG fragment (the host sanitizes it with the same whitelist as loadCharacter). */
  emit(laid: L, env: BandEnv & {h: number}): string;
  verify?(laid: L, env: BandEnv & {h: number}): PluginFinding[];
  rules?: Record<string, string>;
}
export interface Plugin {
  id: string;
  apiVersion: string;
  bands: Record<string, BandKind<any, any>>;
}
export function definePlugin<const P extends {id: string; apiVersion: string; bands: Record<string, BandKind<any, any>>}>(p: P): P {
  if (!/^[a-z][a-z0-9-]*$/.test(p.id)) throw new Error(`definePlugin: id "${p.id}" must be lowercase letters, digits and -`);
  if (p.apiVersion.split('.')[0] !== PLUGIN_API_VERSION.split('.')[0]) throw new Error(`plugin ${p.id}: apiVersion ${p.apiVersion} is not supported (host ${PLUGIN_API_VERSION})`);
  return p;
}

export class PluginNotSuppliedError extends Error {}
/** Per call, never global: the registry is built from what the caller passes. */
export class PluginRegistry {
  readonly byId = new Map<string, Plugin>();
  constructor(plugins: readonly Plugin[]) { for (const p of plugins) { if (this.byId.has(p.id)) throw new Error(`plugin ${p.id} is supplied twice`); this.byId.set(p.id, p); } }
  kind(type: string): {plugin: Plugin; name: string; kind: BandKind<unknown, unknown>} {
    const [pid, name] = type.split(':');
    const plugin = pid === undefined ? undefined : this.byId.get(pid);
    if (!plugin || name === undefined) throw new PluginNotSuppliedError(`the band type "${type}" is a plugin band, but plugin "${pid}" was not supplied: pass it as diagram({plugins: [...]}) / --plugin (a spec never loads code)`);
    const kind = plugin.bands[name];
    if (!kind) throw new PluginNotSuppliedError(`plugin ${plugin.id} has no band "${name}" (it has: ${Object.keys(plugin.bands).join(', ')})`);
    return {plugin, name, kind: kind as BandKind<unknown, unknown>};
  }
}

interface Envelope {type: string; data: unknown; id?: string}
type Laid = RawBand & {x: number; y: number; w: number; h: number; __plugin: Envelope};
const PROBE_W = 940;

const SAFE = /<\s*(script|style|foreignObject|use|image|text)\b|\son\w+\s*=|(?:href|xlink:href)\s*=|currentColor/i;
/** The real host reuses the icon store's sanitizeBody; the spike only shows where the call goes. */
function sanitize(svg: string, where: string): string {
  if (SAFE.test(svg)) throw new Error(`${where}: the SVG fragment uses a forbidden element or attribute`);
  return svg;
}

/**
 * The constructor a plugin's DSL wraps: validates through the kind's build(), fixes the height by laying out once at a probe width, and
 * returns a core `raw` band whose draw() lays out at the real width and emits. `Id` flows to Declares<> so connect() type-checks.
 */
export function pluginBand<const Id extends string = never>(reg: PluginRegistry, type: string, input: unknown, opts: {id?: Id; theme?: BandEnv['theme']} = {}): RawBand & Declares<Id> {
  const {plugin, kind} = reg.kind(type);
  const data = kind.build(input);
  const theme = opts.theme ?? 'blue';
  const probe = kind.layout(data, {x: 0, y: 0, w: PROBE_W, theme});
  const band = raw({h: probe.h, draw: ctx => {
    const env = {x: ctx.x, y: ctx.y, w: ctx.w, theme};
    const {h, laid} = kind.layout(data, env);
    return sanitize(kind.emit(laid, {...env, h}), `plugin ${plugin.id}:${type}`);
  }}) as Laid;
  band.__plugin = {type, data, ...(opts.id ? {id: opts.id} : {})};
  if (opts.id) band.id = opts.id; // raw() does not forward an id; the layout reads it as the anchor of the whole band
  return band as RawBand & Declares<Id>;
}

/**
 * Post-layout: plugin verify over the laid-out raw bands. A plugin 'problem' becomes a verdict problem, a 'warning' / 'advice' a finding
 * (rule id `plugin-id/rule`), and an exception inside the plugin a problem naming the plugin. The merged verdict is returned.
 */
export function withPluginFindings(reg: PluginRegistry, laidOut: LaidOutDiagram, verdict: Verdict, theme: BandEnv['theme'] = 'blue'): Verdict {
  const findings: Finding[] = [], problems: string[] = [];
  const put = (plugin: string, rule: string, sev: 'problem' | 'warning' | 'advice', message: string): void => {
    if (sev === 'problem') problems.push(`[${plugin}] ${message} [${plugin}/${rule}]`);
    else findings.push({rule: `${plugin}/${rule}`, severity: sev === 'warning' ? 'warn' : 'info', message: `[${plugin}] ${message}`});
  };
  for (const b of laidOut.laidOut as LaidOutBand[]) {
    const env = (b as Partial<Laid>).__plugin;
    if (b.type !== 'raw' || !env) continue;
    const {plugin, kind} = reg.kind(env.type);
    try {
      const e = {x: b.x, y: b.y, w: b.w, theme};
      const {h, laid} = kind.layout(env.data, e);
      if (Math.abs(h - b.h) > 0.5) put(plugin.id, 'height-drift', 'warning', `the height reserved at construction (${b.h}) differs from the height at the real width (${h}); a layout hook is needed`);
      for (const f of kind.verify?.(laid, {...e, h}) ?? []) put(plugin.id, f.rule, f.severity, f.message);
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
