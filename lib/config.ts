// Project-wide settings: .svg-diagram.json, found by walking up from the current directory.
//   {"accept": {"rule-id": "why this is fine, for every diagram"}, "maxWidth": 940, "legend": false, "legendLabels": {"tone:accent": "注意"}}
import fs from 'node:fs';
import path from 'node:path';
import type {Config, DiagramData} from './types.ts';
import {DEFAULT_LEGEND_LABELS} from './rules.ts';

export function loadConfig(from: string = process.cwd()): Config {
  let dir = path.resolve(from);
  for (;;) {
    const f = path.join(dir, '.svg-diagram.json');
    if (fs.existsSync(f)) {
      let cfg: Config;
      try { cfg = {...JSON.parse(fs.readFileSync(f, 'utf8')), _file: f}; }
      catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
      checkLegend(cfg, f);
      return cfg;
    }
    const up = path.dirname(dir);
    if (up === dir) return {};
    dir = up;
  }
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

// a diagram's own accept / maxWidth / legend / legendLabels win over the project's
export function applyConfig<D extends Pick<DiagramData, 'accept' | 'maxWidth' | 'legend' | 'legendLabels'>>(d: D, cfg: Config): D {
  d.accept = {...(cfg.accept ?? {}), ...(d.accept ?? {})};
  if (cfg.maxWidth && d.maxWidth == null) d.maxWidth = cfg.maxWidth;
  if (d.legend === undefined && cfg.legend !== undefined) d.legend = cfg.legend;
  if (cfg.legendLabels) d.legendLabels = {...cfg.legendLabels, ...(d.legendLabels ?? {})};
  return d;
}
