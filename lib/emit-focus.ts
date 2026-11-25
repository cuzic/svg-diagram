import {PALETTE, colorOf} from './tokens.ts';
import type {Theme} from './types/core.ts';

/** The colour of an arrow of a graph with `focus` (ADR 0051): lit (it touches a focused item) in the accent colour, the others muted; no focus: `plain`. */
export function focusInk(focused: readonly string[] | undefined, dim: boolean | undefined, day: Theme, plain: string): (from: string | readonly string[], to: string) => string {
  if (!focused || dim) return () => plain;
  const f = new Set(focused);
  return (from, to) => (typeof from === 'string' ? [from] : from).some(x => f.has(x)) || f.has(to) ? colorOf('accent', day) : PALETTE.muted;
}
