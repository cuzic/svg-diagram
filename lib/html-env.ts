// The shell's half of emit-html.ts: the font metrics and the digest it may not read for itself (ADR 0007 §4).
import {createHash} from 'node:crypto';
import {textBox} from './font-metrics.ts';
import {currentFontSpecs} from './measure.ts';
import type {HtmlEnv} from './emit-html.ts';

// ascent / descent of the primary sans font at a size (a browser without that font falls back; the difference is a pixel or two)
const boxMemo = new Map<string, {ascent: number; descent: number}>();
function metrics(size: number, weight: number, mono: boolean): {ascent: number; descent: number} {
  const specs = currentFontSpecs();
  const key = `${mono}|${size}|${weight}|${specs ? JSON.stringify(specs) : ''}`;
  let m = boxMemo.get(key);
  if (!m) {
    try { const b = textBox('あ', mono ? 'mono' : 'sans', size, weight, specs); m = {ascent: b.ascent, descent: b.descent}; }
    catch { m = {ascent: Math.round(size * 0.88), descent: Math.round(size * 0.24)}; }
    boxMemo.set(key, m);
  }
  return m;
}

export const htmlEnv: HtmlEnv = {
  metrics,
  digest: s => createHash('sha1').update(s).digest('hex'),
};
