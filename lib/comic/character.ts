// A character from an artist's material (ADR 0074 D3): one JSON manifest that holds the box, the anchors, the licence and one SVG fragment per expression.
// Loading checks the shape, refuses a manifest with no licence, and cleans each fragment with the icon store's whitelist (shapes, groups, gradients and clip paths; no
// text, style, use, mask, filter, script, outside reference, or named colour). The box is kept as it is (it is not made square). Pure: the data goes in and comes out as JSON.
import {prefixIds, sanitizeBody} from '../icon-store.ts';
import {f1, rgb} from './constants.ts';
import {COMIC_ID} from './template.ts';
import type {BubbleSide, CharacterManifest, ComicCharacter, ComicExpression, ComicLaidHead} from '../types/comic.ts';

export const EXPRESSIONS: readonly ComicExpression[] = ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad'];
const SIDES: readonly BubbleSide[] = ['top-left', 'top', 'top-right', 'left', 'right'];
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Checks a manifest and returns the cleaned character. Throws, naming the field, on a shape that cannot be drawn; a missing licence throws too (a character
 * with no licence must not travel with a comic: `comic-license-missing`).
 */
export function loadCharacter(m: CharacterManifest): ComicCharacter {
  if (!m || typeof m !== 'object') throw new Error('loadCharacter(manifest) に {id, name, box, anchors, expressions, license} を渡してください');
  const at = `素材 ${JSON.stringify(m.id ?? '?')}`;
  if (typeof m.id !== 'string' || !COMIC_ID.test(m.id)) throw new Error(`${at} の id が不正です。英字で始め、英数字と _ - を使ってください`);
  if (!text(m.name)) throw new Error(`${at} の name に表示名を書いてください`);
  const lic = m.license;
  if (!text(lic?.spdx)) throw new Error(`comic-license-missing: ${at} の license.spdx に空でない SPDX 識別子を書いてください`);
  if (!text(lic.author)) throw new Error(`comic-license-missing: ${at} の license.author に空でない作者名を書いてください`);
  if (typeof lic.url !== 'string' || !/^https?:\/\//.test(lic.url)) {
    const value = typeof lic.url === 'string' ? ` (${JSON.stringify(lic.url)})` : '';
    throw new Error(`comic-license-missing: ${at} の license.url${value} に http:// または https:// で始まる URL を書いてください`);
  }
  const box = m.box;
  if (!Array.isArray(box) || box.length !== 4 || ![...box].every(num) || !(box[2] > 0 && box[3] > 0)) throw new Error(`${at} の box は [x, y, width, height] で、幅と高さを正の数にしてください`);
  const a = m.anchors;
  const head = a?.head;
  if (!head || !num(head.cx) || !num(head.cy) || !num(head.r) || head.r <= 0) throw new Error(`${at} の anchors.head は box の座標で {cx, cy, r} を書き、r を正の数にしてください`);
  const [bx, by, bw, bh] = box;
  if (head.r > Math.min(bw, bh) / 2) throw new Error(`${at} の anchors.head.r は ${head.r} です。box の短辺の半分以下にしてください`);
  const hx = head.cx - bx, hy = head.cy - by;
  if (hx < head.r || hx > bw - head.r || hy < head.r || hy > bh - head.r) {
    throw new Error(`${at} の anchors.head は円が box の中に収まるように cx、cy、r を指定してください`);
  }
  if (!point(a.mouth)) throw new Error(`${at} の anchors.mouth に [x, y] を書いてください`);
  if (a.hand !== undefined && !point(a.hand)) throw new Error(`${at} の anchors.hand に [x, y] を書いてください`);
  const sides = m.bubbleSides ?? [];
  if (!Array.isArray(sides) || ![...sides].every(s => SIDES.includes(s))) throw new Error(`${at} の bubbleSides に ${SIDES.join(' / ')} から選んだ配列を書いてください`);
  if (!m.expressions || typeof m.expressions !== 'object') throw new Error(`${at} の expressions に表情と SVG 断片の対応を書いてください`);
  const expressions: Partial<Record<ComicExpression, string>> = {};
  for (const [name, fragment] of Object.entries(m.expressions)) {
    if (!EXPRESSIONS.includes(name as ComicExpression)) throw new Error(`${at} の表情 "${name}" が不明です。${EXPRESSIONS.join(' / ')} を使ってください`);
    if (typeof fragment !== 'string') throw new Error(`${at} の表情 ${name} に SVG 断片を文字列で書いてください`);
    const where = `${at} の表情 ${name}`;
    const {body} = sanitizeBody(fragment, where, true);
    if (/\s(?:fill|stroke|stop-color)="currentColor"/.test(body)) throw new Error(`${where} に currentColor が使われています。紙色とインク色を十六進表記で指定してください`);
    const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    if (new Set(ids).size !== ids.length) throw new Error(`${where} の SVG の id が重複しています。各 id を一意にしてください`);
    expressions[name as ComicExpression] = body;
  }
  if (expressions.neutral === undefined) throw new Error(`${at} の expressions に少なくとも neutral の SVG 断片を書いてください`);
  return {
    id: m.id, name: m.name, box: [box[0], box[1], box[2], box[3]],
    anchors: {head: {cx: head.cx, cy: head.cy, r: head.r}, mouth: [...a.mouth], ...(a.hand ? {hand: [...a.hand]} : {})},
    bubbleSides: [...sides], expressions, license: {spdx: lic.spdx, author: lic.author, url: lic.url},
  };
}

type StageHead = Pick<ComicLaidHead, 'cx' | 'cy' | 'r'>;
const scaleOf = (c: ComicCharacter, head: StageHead): number => head.r / c.anchors.head.r;

/** A point of the box on the panel. */
export const mapPoint = (c: ComicCharacter, head: StageHead, p: readonly [number, number]): [number, number] => {
  const s = scaleOf(c, head);
  return [f1(head.cx + (p[0] - c.anchors.head.cx) * s), f1(head.cy + (p[1] - c.anchors.head.cy) * s)];
};

/** The viewport's origin and scale, using the same mapping as the anchors. */
export function placement(c: ComicCharacter, head: StageHead): {scale: number; x: number; y: number} {
  const [x, y] = mapPoint(c, head, [c.box[0], c.box[1]]);
  return {scale: scaleOf(c, head), x, y};
}

/**
 * The fragment of an expression, placed on the stage head: a nested `<svg>` whose viewBox is the character's box and whose size is the box at the scale (the box is
 * cut by it, and the panel's frame cuts what is below the chest). A nested viewBox places the drawing without a `transform`, and its ids are prefixed (the same
 * character twice in one SVG never shares a gradient or a clip path id).
 */
export function characterSvg(c: ComicCharacter, expression: ComicExpression, head: StageHead, idPrefix: string): string | undefined {
  const body = c.expressions[expression];
  if (body === undefined) return undefined;
  const {scale, x, y} = placement(c, head);
  const [bx, by, bw, bh] = c.box;
  // The diagram's dark theme rewrites six-digit paint tokens. Use equivalent RGB values to keep the artist's paint.
  const paint = body.replace(/(\s(?:fill|stroke|stop-color)=")(#[0-9a-fA-F]{6})"/g, (_match, attr: string, hex: string) => `${attr}${rgb(hex)}"`);
  return `<svg data-character="${c.id}" x="${x}" y="${y}" width="${f1(bw * scale)}" height="${f1(bh * scale)}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none" overflow="hidden">${prefixIds(paint, idPrefix)}</svg>`;
}
