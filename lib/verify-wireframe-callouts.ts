import {at, findingAcceptanceHint} from './finding-rules.ts';
import {must} from './must.ts';
import type {Finding} from './types/verdicts.ts';
import type {LaidOutWireframe, WireframeBand} from './types/wireframe.ts';
import type {WfCallout} from './types/wireframe-nodes.ts';

export const wireframeCalloutRules = /* @__PURE__ */ Object.freeze({
  'wf-callout-no-note': {doc: '図の番号に対応する注釈がない', scope: 'band'},
  'wf-note-no-callout': {doc: '注釈に対応する番号が図にない', scope: 'band'},
  'wf-callout-gap': {doc: '図の番号が 1 からの連番になっていない', scope: 'band'},
  'wf-callout-duplicate': {doc: '同じ番号が複数の場所に付いている（情報）', scope: 'band'},
  'wf-callout-order': {doc: '図の番号が、読む順（上から下、左から右）に並んでいない（情報）', scope: 'band'},
} as const);

// Callout numbers can live on nodes, parts or markers.
function calloutsOf(...trees: unknown[]): number[] {
  const out: number[] = [];
  const walk = (x: unknown): void => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    // a wf node tree is walked generically (any node kind may carry n / parts / markers / children)
    const nd = x as {t?: unknown; n?: unknown; parts?: Record<string, unknown>; markers?: {n?: unknown}[]; children?: unknown};
    if (!nd.t) return;
    if (typeof nd.n === 'number') out.push(nd.n);
    for (const v of Object.values(nd.parts ?? {})) if (typeof v === 'number') out.push(v);
    for (const m of nd.markers ?? []) if (typeof m.n === 'number') out.push(m.n);
    walk(nd.children);
  };
  trees.forEach(walk);
  return out;
}

// the callout numbers should grow in reading order. Rows read top to bottom, columns (a sidebar, a main area) left to right,
// so the next number may sit lower, or clearly to the right — only a step back (up-and-left, or left on the same row) is flagged.
const ORDER_ROW = 48, ORDER_COL = 24;
export function calloutOrderFindings(b: LaidOutWireframe): Finding[] {
  if (!b.callouts?.length) return [];
  const first = new Map<number, WfCallout>();
  for (const c of b.callouts) if (!first.has(c.n)) first.set(c.n, c);
  const nums = [...first.keys()].sort((x, y) => x - y), bad = [];
  for (let i = 0; i + 1 < nums.length; i++) {
    const a = must(first.get(must(nums[i]))), c = must(first.get(must(nums[i + 1])));
    const leftOfIt = c.x < a.x - ORDER_COL && c.y < a.y + ORDER_ROW;       // not on a later row, yet to the left
    const aboveIt = c.y < a.y - ORDER_ROW && c.x < a.x + ORDER_COL;        // higher up, and not in a column further right
    if (leftOfIt || aboveIt) bad.push(`${nums[i]}→${nums[i + 1]}`);
  }
  return bad.length ? [{...at(b), rule: 'wf-callout-order', severity: 'info', message: `${b.title ? `「${b.title}」` : 'ワイヤーフレーム'}: 番号が読む順でない所: ${bad.join('、')}`}] : [];
}

export function calloutNoteFindings(b: WireframeBand): Finding[] {
  const out: Finding[] = [];
  const calls = calloutsOf(b.root, b.overlays);
  const noteNums = (b.notes ?? []).map((nt, i) => (typeof nt === 'object' && nt.n != null ? nt.n : i + 1));
  const where = b.title ? `「${b.title}」` : 'ワイヤーフレーム';
  const uniq = [...new Set(calls)].sort((x, y) => x - y);
  const noNote = uniq.filter(c => !noteNums.includes(c));
  if (noNote.length) out.push({...at(b), rule: 'wf-callout-no-note', severity: 'warn', message: `${where}: 番号 ${noNote.join('・')} に対応する注釈がない`});
  const noCall = noteNums.filter(nn => !calls.includes(nn));
  if (b.notes?.length && noCall.length) out.push({...at(b), rule: 'wf-note-no-callout', severity: 'warn', message: `${where}: 注釈 ${noCall.join('・')} に対応する番号が図にない`});
  if (uniq.length && uniq.some((c, i) => c !== i + 1)) out.push({...at(b), rule: 'wf-callout-gap', severity: 'warn', message: `${where}: 番号が 1 からの連番でない（${uniq.join('・')}）`});
  const dup = uniq.filter(c => calls.filter(x => x === c).length > 1);
  if (dup.length) out.push({...at(b), rule: 'wf-callout-duplicate', severity: 'info', message: `${where}: 番号 ${dup.join('・')} が複数の場所に付いている（1 つの注釈を共有）`});
  return out;
}

export const dialogProblems = (laid: {problems?: string[]}) => (laid.problems ?? []).map(message => ({rule: 'wf-dialog-too-big', severity: 'problem' as const, message}));

export const wireframeCalloutVerification = {
  findings: calloutNoteFindings,
  layoutFindings: calloutOrderFindings,
  acceptHint: (rule: string) => Object.hasOwn(wireframeCalloutRules, rule) ? findingAcceptanceHint(rule) : undefined,
};
