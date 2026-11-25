import {texToSvg} from '../math-tex.ts';
import type {Declares, HandleOf} from '../strict.ts';
import {ROLES} from '../tokens.ts';
import type {MathBand, MathOpts} from '../types/math.ts';
import {assertNoReveal, withHandle} from './shared.ts';

// A TeX formula, drawn as outlines (MathJax): math(String.raw`\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}`). Use String.raw so the
// backslashes stay. Display style by default; `inline: true` sets it as it would be inside a sentence. No reveal (it is one picture).
// Here, not with the pure builders: the formula is converted now (MathJax is loaded on the first call).
export function math<const Id extends string = never>(tex: string, opts?: MathOpts & {id?: Id}): MathBand & Declares<Id> & HandleOf<Id>;
export function math(tex: string, opts: MathOpts = {}): MathBand {
  assertNoReveal(opts, 'math()');
  if (typeof tex !== 'string' || !tex.trim()) throw new Error('math(tex) needs the TeX source of the formula (a non-empty string)');
  if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align)) throw new Error(`math(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
  if (opts.tone !== undefined && !['text', 'accent', 'muted', 'danger'].includes(opts.tone)) throw new Error(`math(): tone must be 'text', 'accent', 'muted' or 'danger' (got ${opts.tone})`);
  if (opts.role !== undefined && !(opts.role in ROLES)) throw new Error(`math(): role must be one of ${Object.keys(ROLES).join(', ')} (got ${opts.role})`);
  return withHandle({type: 'math', tex, drawing: texToSvg(tex, !opts.inline), role: opts.role ?? 'body', align: opts.align ?? 'center', tone: opts.tone ?? 'text', alt: opts.alt?.trim() || tex, ...(opts.id === undefined ? {} : {id: opts.id})}, opts.id);
}
