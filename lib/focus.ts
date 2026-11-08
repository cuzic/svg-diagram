// focus: "you are here" inside one figure (ADR 0051). diagram({spotlight}) dims whole figures; `focus` colours the items of one figure.
// One rule for every band that has items: the focused items are filled ('solid'), the items related to them are 'accent', the rest 'muted'.
// What "related" means depends on the figure:
//   a tree / mindmap: the nodes under a focused node and the path up to the root (and the lines between them are lit);
//   a graph (stateDiagram, flowchart, causeTree, pdpc, classDiagram, bpmn, swimlane): the items one arrow away (the arrows that touch a focused item are lit);
//   a sequence (chevron, funnel, cycle, steps, emblem, valueChain): nothing — the focused step stands out of the muted rest.
// The resolution is pure and runs in the DSL: it writes the tones onto (copies of) the items, so layout and the checks see ordinary tones.
import type {EmphasisTone, Focus} from './types/core.ts';
export type {Focus};

export const FOCUSED: EmphasisTone = 'solid', RELATED: EmphasisTone = 'accent', OTHER: EmphasisTone = 'muted';

/**
 * The indices of the focused items. `ids[i]` is the id of item i (undefined: it has none). Numbers (1-based positions) are taken
 * only when `numbers` is true (a sequence); anything that names no item throws, listing what can be named.
 */
export function resolveFocus(focus: Focus, ids: readonly (string | undefined)[], who: string, numbers = false): Set<number> {
  const refs: readonly unknown[] = Array.isArray(focus) ? focus : [focus];
  const what = numbers ? `the id of an item or its number 1..${ids.length}` : 'the id of an item';
  if (!refs.length) throw new Error(`${who}: focus is ${what}, or a list of them (got an empty list)`);
  const known = ids.filter((id): id is string => typeof id === 'string');
  const out = new Set<number>();
  for (const r of refs) {
    if (typeof r === 'number') {
      if (!numbers) throw new Error(`${who}: focus is ${what} (got ${r}: this figure names its items by id)`);
      if (!Number.isInteger(r) || r < 1 || r > ids.length) throw new Error(`${who}: focus ${r} is not an item number 1..${ids.length}`);
      out.add(r - 1);
    } else if (typeof r === 'string' && r) {
      const i = ids.indexOf(r);
      if (i < 0) throw new Error(`${who}: focus "${r}" is not the id of an item${known.length ? ` (the ids: ${known.join(', ')})` : numbers ? ` (no item has an id: give it one, or use its number 1..${ids.length})` : ' (no item has an id)'}`);
      out.add(i);
    } else throw new Error(`${who}: focus is ${what}, or a list of them (got ${JSON.stringify(r)})`);
  }
  return out;
}

/** A graph: the focused items solid, the ones a link away accent, the rest muted. `links` are pairs of item indices (either direction). */
export function graphTones(n: number, links: readonly (readonly [number, number])[], focused: ReadonlySet<number>): EmphasisTone[] {
  const near = new Set<number>();
  for (const [a, b] of links) { if (focused.has(a)) near.add(b); if (focused.has(b)) near.add(a); }
  return Array.from({length: n}, (_, i) => focused.has(i) ? FOCUSED : near.has(i) ? RELATED : OTHER);
}

/** A sequence: the focused items solid, the rest muted. */
export function sequenceTones(n: number, focused: ReadonlySet<number>): EmphasisTone[] {
  return Array.from({length: n}, (_, i) => focused.has(i) ? FOCUSED : OTHER);
}

/** A link of a graph is lit when it touches a focused item. */
export const litLink = (a: number, b: number, focused: ReadonlySet<number>): boolean => focused.has(a) || focused.has(b);
