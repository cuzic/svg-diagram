// Project-wide settings: .svg-diagram.json, found by walking up from the current directory.
//   {"accept": {"rule-id": "why this is fine, for every diagram"}, "maxWidth": 940}
import fs from 'node:fs';
import path from 'node:path';
export function loadConfig(from = process.cwd()) {
    let dir = path.resolve(from);
    for (;;) {
        const f = path.join(dir, '.svg-diagram.json');
        if (fs.existsSync(f)) {
            try {
                return { ...JSON.parse(fs.readFileSync(f, 'utf8')), _file: f };
            }
            catch (e) {
                throw new Error(`${f}: ${e.message}`);
            }
        }
        const up = path.dirname(dir);
        if (up === dir)
            return {};
        dir = up;
    }
}
// a diagram's own accept / maxWidth win over the project's
export function applyConfig(d, cfg) {
    d.accept = { ...(cfg.accept ?? {}), ...(d.accept ?? {}) };
    if (cfg.maxWidth && d.maxWidth == null)
        d.maxWidth = cfg.maxWidth;
    return d;
}
