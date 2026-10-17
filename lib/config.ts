// Project-wide settings: .svg-diagram.json, found by walking up from the current directory.
//   {"accept": {"rule-id": "why this is fine, for every diagram"}, "maxWidth": 940, "legend": false, "legendLabels": {"tone:accent": "注意"}, "tones": {"accent": {"fill": "#e6d3bd"}}}
import fs from 'node:fs';
import path from 'node:path';
import type {DiagramData} from './types/core.ts';
import type {Config} from './types/project.ts';
import {DEFAULT_LEGEND_LABELS, RULE_DOCS} from './rules.ts';
import {checkMinText, checkTones, MIN_FONT_SIZE, mergeTones} from './tokens.ts';
import {checkToday, resolveToday} from './today.ts';
import {measureSettingsOf} from './measure-settings.ts';

export function loadConfig(from: string = process.cwd()): Config {
  let dir = path.resolve(from);
  for (;;) {
    const f = path.join(dir, '.svg-diagram.json');
    if (fs.existsSync(f)) return readConfigFile(f);
    const up = path.dirname(dir);
    if (up === dir) return {};
    dir = up;
  }
}

/** One .svg-diagram.json, read and checked (`--config <path>` names it directly). */
export function readConfigFile(f: string): Config {
  let cfg: Config;
  try { cfg = {...JSON.parse(fs.readFileSync(f, 'utf8')), _file: f}; }
  catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
  checkLegend(cfg, f);
  checkAccept(cfg, f);
  checkTerms(cfg, f);
  checkFontFloor(cfg, f);
  if (cfg.keepWords !== undefined && typeof cfg.keepWords !== 'boolean') throw new Error(`${f}: "keepWords" must be true or false (got ${JSON.stringify(cfg.keepWords)})`);
  if (cfg.today !== undefined) { try { checkToday(cfg.today, '"today"'); } catch (e) { throw new Error(`${f}: ${(e as Error).message}`); } }
  delete cfg._today;
  if (cfg.tones !== undefined) { try { cfg.tones = checkTones(cfg.tones, '"tones"'); } catch (e) { throw new Error(`${f}: ${(e as Error).message}`); } }
  return cfg;
}

// JSON has no types: a typo in legend / legendLabels would otherwise be dropped without a word (a diagram's own are checked by tsc / diagram())
function checkLegend(cfg: Config, f: string): void {
  if (cfg.legend !== undefined && cfg.legend !== 'auto' && cfg.legend !== false) throw new Error(`${f}: "legend" must be "auto" or false (got ${JSON.stringify(cfg.legend)})`);
  const labels: unknown = cfg.legendLabels;
  if (labels === undefined) return;
  if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) throw new Error(`${f}: "legendLabels" must be an object like {"tone:accent": "注意"}`);
  for (const [k, v] of Object.entries(labels)) {
    if (!(k in DEFAULT_LEGEND_LABELS)) throw new Error(`${f}: legendLabels: unknown key "${k}" (one of ${Object.keys(DEFAULT_LEGEND_LABELS).join(', ')})`);
    if (typeof v !== 'string' || !v) throw new Error(`${f}: legendLabels["${k}"] must be a non-empty string`);
  }
}

// a typo'd rule id would accept nothing, silently
function checkAccept(cfg: Config, f: string): void {
  const acc: unknown = cfg.accept;
  if (acc === undefined) return;
  if (typeof acc !== 'object' || acc === null || Array.isArray(acc)) throw new Error(`${f}: "accept" must be an object like {"gray-tone-collision": "why this is fine"}`);
  for (const [k, v] of Object.entries(acc)) {
    if (!Object.hasOwn(RULE_DOCS, k)) throw new Error(`${f}: accept: unknown rule "${k}" (see RULE_DOCS: ${Object.keys(RULE_DOCS).join(', ')})`);
    if (typeof v !== 'string' || !v.trim()) throw new Error(`${f}: accept["${k}"] must be a non-empty reason string`);
  }
}

// {"terms": {"ユーザー": ["利用者"]}}: a typo here (a string instead of a list) would otherwise match nothing, silently
function checkTerms(cfg: Config, f: string): void {
  const t: unknown = cfg.terms;
  if (t === undefined) return;
  if (typeof t !== 'object' || t === null || Array.isArray(t)) throw new Error(`${f}: "terms" must be an object like {"ユーザー": ["利用者", "ユザー"]}`);
  for (const [k, v] of Object.entries(t)) if (!Array.isArray(v) || !v.length || v.some(x => typeof x !== 'string' || !x)) throw new Error(`${f}: terms["${k}"] must be a non-empty list of spellings to avoid`);
}

// {"fontFloor": 10}: how low a canvas diagram may declare minText (ADR 0017); above 14 would mean nothing
function checkFontFloor(cfg: Config, f: string): void {
  if (cfg.fontFloor === undefined) return;
  try { checkMinText(cfg.fontFloor, '"fontFloor"'); } catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
  if (cfg.fontFloor > MIN_FONT_SIZE) throw new Error(`${f}: "fontFloor" must be at most ${MIN_FONT_SIZE} (the default; it only lowers what a diagram may declare) (got ${cfg.fontFloor})`);
}

// a diagram's own accept / maxWidth / legend / legendLabels win over the project's
export function applyConfig<D extends Pick<DiagramData, 'today' | 'accept' | 'terms' | 'maxWidth' | 'legend' | 'legendLabels' | 'tones' | 'canvas' | 'keepWords' | 'measure'>>(d: D, cfg: Config): D {
  const floor = cfg.fontFloor ?? MIN_FONT_SIZE;
  if (d.canvas && d.canvas.minText < floor) throw new Error(`canvas: {minText: ${d.canvas.minText}} is below the project's fontFloor (${floor}). Lower "fontFloor" in .svg-diagram.json (10 at the lowest) or raise minText`);
  d.measure ??= measureSettingsOf(cfg); // the diagram measures with its own project's settings, whatever else is loaded meanwhile (ADR 0031 §2)
  d.today ??= resolveToday(cfg._today, cfg.today); // the caller's day for today: 'auto' (ADR 0022 D1)
  d.accept = {...(cfg.accept ?? {}), ...(d.accept ?? {})};
  if (cfg.terms) d.terms = {...cfg.terms, ...(d.terms ?? {})};
  if (cfg.maxWidth && d.maxWidth == null) d.maxWidth = cfg.maxWidth;
  if (d.legend === undefined && cfg.legend !== undefined) d.legend = cfg.legend;
  if (d.keepWords === undefined && cfg.keepWords !== undefined) d.keepWords = cfg.keepWords;
  d.tones = mergeTones(cfg.tones, d.tones);
  if (cfg.legendLabels) d.legendLabels = {...cfg.legendLabels, ...(d.legendLabels ?? {})};
  return d;
}
