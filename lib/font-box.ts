// The glyph box of a line of text for the HTML emit (ADR 0031 §3): the ascent and descent of the primary font at a size. A shell file:
// it reads font files. emit-html.ts is given the result as a function and reads nothing itself.
import {textBox} from './font-metrics.ts';
import {defaultMeasureSettings} from './measure.ts';
import type {FontBox} from './emit-html.ts';
import type {MeasureSettings} from './types/core.ts';

// ascent / descent of the primary font at a size (a browser without that font falls back; the difference is a pixel or two)
const memo = new Map<string, {ascent: number; descent: number}>();

/** The glyph boxes for a diagram measured with `settings` (default: the process default). */
export function fontBoxOf(settings: MeasureSettings = defaultMeasureSettings()): FontBox {
  const specs = settings.fonts;
  return (size, weight, mono) => {
    const key = `${mono}|${size}|${weight}|${specs ? JSON.stringify(specs) : ''}`;
    let m = memo.get(key);
    if (!m) {
      try { const b = textBox('あ', mono ? 'mono' : 'sans', size, weight, specs); m = {ascent: b.ascent, descent: b.descent}; }
      catch { m = {ascent: Math.round(size * 0.88), descent: Math.round(size * 0.24)}; }
      memo.set(key, m);
    }
    return m;
  };
}
