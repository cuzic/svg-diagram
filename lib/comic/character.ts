// A character from an artist's material (ADR 0074 D3): one JSON manifest that holds the box, the anchors, the licence and one SVG fragment per expression.
// Loading checks the shape, refuses a manifest with no licence, and cleans each fragment with the icon store's whitelist (shapes, groups, gradients and clip paths; no
// text, style, use, mask, filter, script, outside reference, or named colour). The box is kept as it is (it is not made square). Pure: the data goes in and comes out as JSON.
import {prefixIds, sanitizeBody} from '../icon-store.ts';
import {f1} from './constants.ts';
import type {BubbleSide, CharacterManifest, ComicCharacter, ComicExpression, ComicLaidHead} from '../types/comic.ts';

export const EXPRESSIONS: readonly ComicExpression[] = ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad'];
const SIDES: readonly BubbleSide[] = ['top-left', 'top', 'top-right', 'left', 'right'];
const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(num);

/**
 * Checks a manifest and returns the cleaned character. Throws, naming the field, on a shape that cannot be drawn; a missing licence throws too (a character
 * with no licence must not travel with a comic: `comic-license-missing`).
 */
export function loadCharacter(m: CharacterManifest): ComicCharacter {
  const at = `character ${JSON.stringify((m as {id?: unknown} | undefined)?.id ?? '?')}`;
  if (!m || typeof m !== 'object') throw new Error('loadCharacter(manifest): the manifest is an object {id, name, box, anchors, expressions, license}');
  if (typeof m.id !== 'string' || !ID.test(m.id)) throw new Error(`${at}: id must be letters, digits, _ and - (starting with a letter)`);
  if (typeof m.name !== 'string' || m.name === '') throw new Error(`${at}: name is the display name`);
  const lic = m.license;
  if (!lic || typeof lic !== 'object' || ['spdx', 'author', 'url'].some(k => typeof (lic as unknown as Record<string, unknown>)[k] !== 'string' || (lic as unknown as Record<string, string>)[k] === '')) {
    throw new Error(`comic-license-missing: ${at} has no licence {spdx, author, url} (a character travels with its licence)`);
  }
  const box = m.box;
  if (!Array.isArray(box) || box.length !== 4 || !box.every(num) || !((box[2] as number) > 0) || !((box[3] as number) > 0)) throw new Error(`${at}: box is [x, y, width, height] with a positive size`);
  const a = m.anchors;
  const head = a?.head;
  if (!head || !num(head.cx) || !num(head.cy) || !num(head.r) || head.r <= 0) throw new Error(`${at}: anchors.head is {cx, cy, r} in the box's coordinates, r > 0`);
  if (!point(a.mouth)) throw new Error(`${at}: anchors.mouth is [x, y]`);
  if (a.hand !== undefined && !point(a.hand)) throw new Error(`${at}: anchors.hand is [x, y]`);
  const sides = m.bubbleSides ?? [];
  for (const s of sides) if (!SIDES.includes(s)) throw new Error(`${at}: bubbleSides "${s}" is not one of ${SIDES.join(' / ')}`);
  if (!m.expressions || typeof m.expressions !== 'object') throw new Error(`${at}: expressions is {neutral: '<g>…</g>', …}`);
  const expressions: Partial<Record<ComicExpression, string>> = {};
  for (const [name, fragment] of Object.entries(m.expressions)) {
    if (!EXPRESSIONS.includes(name as ComicExpression)) throw new Error(`${at}: expression "${name}" is not one of ${EXPRESSIONS.join(' / ')}`);
    if (typeof fragment !== 'string') throw new Error(`${at}: expression ${name} is an SVG fragment (a string)`);
    expressions[name as ComicExpression] = sanitizeBody(fragment, `${at}: expression ${name}`, true).body;
  }
  if (expressions.neutral === undefined) throw new Error(`${at}: expressions needs at least neutral`);
  return {id: m.id, name: m.name, box: [box[0], box[1], box[2], box[3]], anchors: {head: {cx: head.cx, cy: head.cy, r: head.r}, mouth: [a.mouth[0], a.mouth[1]], ...(a.hand ? {hand: [a.hand[0], a.hand[1]] as [number, number]} : {})}, bubbleSides: [...sides], expressions, license: {spdx: lic.spdx, author: lic.author, url: lic.url}};
}

/** How the character's box maps onto a stage head: the scale puts the box's head circle on the stage's (radius `r`), and the head centres meet. */
export function placement(c: ComicCharacter, head: Pick<ComicLaidHead, 'cx' | 'cy' | 'r'>): {scale: number; dx: number; dy: number} {
  const scale = head.r / c.anchors.head.r;
  return {scale: Math.round(scale * 1000) / 1000, dx: f1(head.cx - c.anchors.head.cx * scale), dy: f1(head.cy - c.anchors.head.cy * scale)};
}
/** A point of the box on the panel. */
export const mapPoint = (c: ComicCharacter, head: Pick<ComicLaidHead, 'cx' | 'cy' | 'r'>, p: readonly [number, number]): [number, number] => {
  const s = head.r / c.anchors.head.r;
  return [f1(head.cx + (p[0] - c.anchors.head.cx) * s), f1(head.cy + (p[1] - c.anchors.head.cy) * s)];
};

/**
 * The fragment of an expression, placed on the stage head: a nested `<svg>` whose viewBox is the character's box and whose size is the box at the scale (the box is
 * cut by it, and the panel's frame cuts what is below the chest). A nested viewBox places the drawing without a `transform`, and its ids are prefixed (the same
 * character twice in one SVG never shares a gradient or a clip path id).
 */
export function characterSvg(c: ComicCharacter, expression: ComicExpression, head: Pick<ComicLaidHead, 'cx' | 'cy' | 'r'>, idPrefix: string): string | undefined {
  const body = c.expressions[expression];
  if (body === undefined) return undefined;
  const {scale, dx, dy} = placement(c, head);
  const [bx, by, bw, bh] = c.box;
  return `<svg data-character="${c.id}" x="${f1(dx + bx * scale)}" y="${f1(dy + by * scale)}" width="${f1(bw * scale)}" height="${f1(bh * scale)}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none" overflow="hidden">${prefixIds(body, idPrefix)}</svg>`;
}
