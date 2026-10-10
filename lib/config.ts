// Project-wide settings: .svg-diagram.json, found by walking up from the current directory.
//   {"accept": {"rule-id": "why this is fine, for every diagram"}, "maxWidth": 940}
import fs from 'node:fs';
import path from 'node:path';
import type {Config, DiagramData} from './types.ts';

export function loadConfig(from: string = process.cwd()): Config {
  let dir = path.resolve(from);
  for (;;) {
    const f = path.join(dir, '.svg-diagram.json');
    if (fs.existsSync(f)) {
      try { return {...JSON.parse(fs.readFileSync(f, 'utf8')), _file: f}; }
      catch (e) { throw new Error(`${f}: ${(e as Error).message}`); }
    }
    const up = path.dirname(dir);
    if (up === dir) return {};
    dir = up;
  }
}

// a diagram's own accept / maxWidth win over the project's
export function applyConfig<D extends Pick<DiagramData, 'accept' | 'maxWidth'>>(d: D, cfg: Config): D {
  d.accept = {...(cfg.accept ?? {}), ...(d.accept ?? {})};
  if (cfg.maxWidth && d.maxWidth == null) d.maxWidth = cfg.maxWidth;
  return d;
}
