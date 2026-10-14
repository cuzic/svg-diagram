import {MIN_FONT_SIZE, isSolidTone} from '../tokens.ts';
import type {Band} from '../types/index.ts';

// `const list = box({id: 'list'})`: a band built with an id also works as a handle (`list.right`, `list.at('top', 0.25)`),
// so connect() can name it without typing the id again. The helpers are NON-enumerable properties: spreading or
// serialising a band, and every existing consumer of bands, sees exactly what it saw before.
export function handleFor(id: string) {
  const side = (s: string) => `${id}:${s}`;
  return {
    left: {value: side('left')}, right: {value: side('right')}, top: {value: side('top')}, bottom: {value: side('bottom')}, center: {value: side('center')},
    at: {value: (s: string, t: number) => `${id}:${s}@${t}`},
  };
}
export function withHandle<T extends object>(band: T, id: string | undefined): T {
  if (id) Object.defineProperties(band, handleFor(id));
  return band;
}
// screens() / swimlane(): `.anchors.<id>` is the handle of each item / step that has an id.
export function withAnchors<T extends object>(band: T, ids: (string | undefined)[]): T {
  const anchors: Record<string, object> = {};
  for (const id of ids) if (id) anchors[id] = Object.defineProperties({id}, handleFor(id));
  return Object.defineProperty(band, 'anchors', {value: anchors});
}
// `reveal` goes onto a band only when it was given, so a band built without it is byte-for-byte what it was.
export const revealOf = (opts: {reveal?: number; until?: number}): {reveal?: number; until?: number} => ({...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until})});
// A constructor with no `reveal` (legend, spacer, raw, ...) refuses one instead of dropping it: the types already do, a JS caller is told here.
export function assertNoReveal(opts: object | undefined, what: string): void {
  if (opts && (['reveal', 'until'] as const).some(k => k in opts && (opts as Record<string, unknown>)[k] !== undefined)) throw new Error(`${what}: takes no reveal — it is shown from the start (reveal goes on box, banner, stat, caption, group, row's children, table, sequence, swimlane, plane, bars and connect)`);
}
// group / table rows / sequence / swimlane lanes carry dark text (or white boxes) on their fill, which a solid fill would swallow:
// the types leave 'solid' / 'solid-danger' out (BoxTone), and this is the same rule for JS callers.
export function assertBoxTone(tone: string | undefined, what: string): void {
  if (isSolidTone(tone)) throw new Error(`${what}: tone '${tone}' is for box() / banner() / stat() / a swimlane step / a legend item only — what sits on it would read dark on the fill; use 'accent' here`);
}
export function assertTextRole(role: string | undefined, allowed: readonly string[], what: string): void {
  if (role !== undefined && !allowed.includes(role)) throw new Error(`${what} must be ${allowed.map(r => `'${r}'`).join(' | ')} (got ${JSON.stringify(role)})`);
}
// A band copied with the same properties (including the non-enumerable handles) so a diagram's defaults never change the
// object the caller holds — the same band can be added to another diagram with other defaults (or none).
export function cloneBand<T extends object>(b: T): T {
  return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b)) as T;
}
/** Maps a band list; a container is copied only when something inside it changed. */
export function mapBands(bands: Band[], fn: (b: Band) => Band | undefined): Band[] {
  return bands.map(b => {
    const changed = fn(b);
    if (changed) return changed;
    if ('children' in b && Array.isArray(b.children)) {
      const kids = mapBands(b.children as Band[], fn);
      if (kids.some((k, i) => k !== (b.children as Band[])[i])) return Object.assign(cloneBand(b), {children: kids});
    }
    return b;
  });
}
/** The ids of a tree's nodes (its own, and every descendant's). */
export type TreeIds<T> = (T extends {readonly id: infer I extends string} ? I : never) | (T extends {readonly children: readonly (infer C)[]} ? TreeIds<C> : never);
export function assertFontSize(size: number): void {
  if (size < MIN_FONT_SIZE) {
    throw new Error(`font-size ${size} is below the ${MIN_FONT_SIZE}px floor — this deck never uses smaller text. Reconsider the layout instead of shrinking the text.`);
  }
}
