import {BOX_TONE, items, list, object, text} from '../spec-kit.ts';
import type {PartDef, Json, JsonSchema} from '../spec-kit.ts';
/** The `n` of 'parts[n]', to give the bands a part builds ids of their own. */
const partNo = (at: string): string => /\d+/.exec(at)?.[0] ?? '0';

const sideItems = (description: string): JsonSchema => ({...list(object({title: text('The point.', 60), body: text('A second, smaller line.', 120), tone: BOX_TONE}, ['title']), 5, 1), description});
const side = (description: string): JsonSchema => object({title: text('The heading of the side.', 40), tone: BOX_TONE, items: sideItems(description)}, ['title', 'items'], description);
const versusSide = (s: Json, id: string, box: (opts: never) => unknown): Json => ({id, title: s['title'], ...(s['tone'] === undefined ? {} : {tone: s['tone']}), children: items(s, 'items').map(i => box(i as never))});

export function defineVersusPart<Result>(builder: (left: never, right: never, opts?: {shared: never; connectLabels?: {left?: string; right?: string}}) => Result, box: (opts: never) => unknown): PartDef<Result> {
  return {
    type: 'versus',
    description: 'Two sides compared in two framed columns, such as before and after, the usual view and the real cause, or plan A and plan B. A third frame under both (shared) can show what they have in common, joined to each side by an arrow.',
    schema: object({
      type: {const: 'versus'},
      left: side('The left side.'),
      right: side('The right side.'),
      shared: object({title: text('The heading.', 40), tone: BOX_TONE, items: sideItems('What both sides share.'), leftLabel: text('The text on the arrow from the left side.', 20), rightLabel: text('The text on the arrow from the right side.', 20)}, ['title', 'items'], 'A frame under both sides, joined to each.'),
    }, ['type', 'left', 'right']),
    example: {type: 'versus', left: {title: '導入前', tone: 'muted', items: [{title: '紙で申請する'}, {title: '承認に 3 日かかる'}]}, right: {title: '導入後', tone: 'accent', items: [{title: 'スマホで申請する'}, {title: '当日中に承認される'}]}},
    check() {},
    build(part, at) {
      const n = partNo(at), sh = part['shared'] as Json | undefined;
      const left = versusSide(part['left'] as Json, `vs${n}-left`, box), right = versusSide(part['right'] as Json, `vs${n}-right`, box);
      if (!sh) return builder(left as never, right as never);
      const labels = {...(sh['leftLabel'] === undefined ? {} : {left: sh['leftLabel'] as string}), ...(sh['rightLabel'] === undefined ? {} : {right: sh['rightLabel'] as string})};
      return builder(left as never, right as never, {shared: versusSide(sh, `vs${n}-shared`, box) as never, ...(Object.keys(labels).length ? {connectLabels: labels} : {})});
    },
  };
}
