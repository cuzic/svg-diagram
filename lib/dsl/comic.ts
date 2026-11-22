// comic() and speechBubble() (ADR 0074 D1 / D2): the meaning-first data of a comic with blanks. The data holds no coordinates and no sizes; the layout works
// them out (lib/comic/). The constructors throw on what cannot be drawn at all (an unknown layout, a malformed id or template); what a worksheet may
// get wrong and still be drawn (a speaker not on the stage, too many lines) is a finding of the check, not an error here.
import {COMIC_ID, parseTemplate} from '../comic/template.ts';
import type {Declares, HandleOf} from '../strict.ts';
import type {BubbleKind, ComicAspect, ComicAt, ComicBand, ComicDialogue, ComicExpression, ComicOpts, ComicPanel, ComicSlotDef, ComicWorksheet} from '../types/comic.ts';
import {revealOf, scopeOpt, withHandle} from './shared.ts';

const LAYOUTS = ['1x4', '2x2', '1x3', '1x2'] as const;
const KINDS: readonly BubbleKind[] = ['say', 'think', 'shout', 'narration'];
const ATS: readonly ComicAt[] = ['left', 'center', 'right'];
const EXPRESSIONS: readonly ComicExpression[] = ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad'];
const ASPECTS: readonly ComicAspect[] = ['7:5', '6:5', '1:1'];

const assertId = (id: unknown, what: string): string => {
  if (typeof id !== 'string' || !COMIC_ID.test(id)) throw new Error(`${what}: id ${JSON.stringify(id)} must be letters, digits, _ and - (starting with a letter; no . : @ #)`);
  return id;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], what: string): T => {
  if (!list.includes(v as T)) throw new Error(`${what}: ${JSON.stringify(v)} is not one of ${list.join(' / ')}`);
  return v as T;
};

/**
 * One line of speech (ADR 0074 calls it bubble(); that name is the bubble chart's): a template with blanks (`{id}`) and who says it. The shape is shared with chat().
 *   speechBubble({id: 'd1', who: 'me', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}})
 */
export function speechBubble(d: ComicDialogue): ComicDialogue {
  assertId(d.id, 'speechBubble()');
  oneOf(d.kind, KINDS, `speechBubble() ${d.id}: kind`);
  if (d.who !== undefined) assertId(d.who, `speechBubble() ${d.id}: who`);
  else if (d.kind !== 'narration') throw new Error(`speechBubble() ${d.id}: who is the speaker (a key of cast); only a narration has none`);
  if (typeof d.tpl !== 'string' || d.tpl === '') throw new Error(`speechBubble() ${d.id}: tpl is the text, with {id} for a blank`);
  parseTemplate(d.tpl, `speechBubble() ${d.id}`);
  const slots: Record<string, ComicSlotDef> = {};
  for (const [sid, def] of Object.entries(d.slots ?? {})) {
    assertId(sid, `speechBubble() ${d.id}: slots`);
    slots[sid] = {...def, ...(def.choices === undefined ? {} : {choices: [...def.choices]})};
  }
  return {id: d.id, ...(d.who === undefined ? {} : {who: d.who}), kind: d.kind, tpl: d.tpl, ...(d.slots === undefined ? {} : {slots})};
}

function panelOf(p: ComicPanel): ComicPanel {
  assertId(p.id, 'comic(): panel');
  if (!Array.isArray(p.stage) || !Array.isArray(p.dialogue)) throw new Error(`comic(): panel ${p.id} needs stage and dialogue (lists)`);
  const ids = new Set<string>();
  const dialogue = p.dialogue.map(d => {
    const b = speechBubble(d);
    if (ids.has(b.id)) throw new Error(`comic(): panel ${p.id} has two dialogue ids "${b.id}"`);
    ids.add(b.id);
    return b;
  });
  const stage = p.stage.map(s => ({who: assertId(s.who, `comic(): panel ${p.id} stage`), at: oneOf(s.at, ATS, `comic(): panel ${p.id} stage at`), expression: oneOf(s.expression, EXPRESSIONS, `comic(): panel ${p.id} stage expression`)}));
  return {id: p.id, ...(p.bg === undefined ? {} : {bg: {...p.bg}}), ...(p.thumb === undefined ? {} : {thumb: p.thumb}), stage, dialogue};
}

/**
 * A comic with blanks: panels in a named layout, people at fixed places (left / center / right), bubbles over their heads. The values of the blanks are
 * not part of it (ADR 0074 D5).
 *   comic({version: 1, title: '早く帰る', layout: '1x4', cast: {me: {name: '私'}, col: {name: '同僚'}},
 *     panels: [{id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: '週に一度は早く帰る'}]}, ...]})
 */
export function comic<const Id extends string = never>(sheet: ComicWorksheet, opts?: ComicOpts & {id?: Id}): ComicBand & Declares<Id> & HandleOf<Id>;
export function comic(sheet: ComicWorksheet, opts: ComicOpts = {}): ComicBand {
  if (!sheet || typeof sheet !== 'object') throw new Error('comic(sheet) needs the worksheet: {version, title, layout, cast, panels}');
  if (sheet.version !== 1) throw new Error(`comic(): version must be 1 (got ${JSON.stringify(sheet.version)})`);
  if (typeof sheet.title !== 'string' || sheet.title === '') throw new Error('comic(): title is the name of the comic');
  oneOf(sheet.layout, LAYOUTS, 'comic(): layout');
  if (!sheet.cast || typeof sheet.cast !== 'object') throw new Error('comic(): cast is {id: {name}} of the people');
  for (const k of Object.keys(sheet.cast)) assertId(k, 'comic(): cast');
  if (!Array.isArray(sheet.panels)) throw new Error('comic(): panels is a list');
  if (opts.aspect !== undefined) oneOf(opts.aspect, ASPECTS, 'comic(): aspect');
  if (opts.writing !== undefined && opts.writing !== 'horizontal') throw new Error("comic(): writing: 'vertical' is not implemented yet (only 'horizontal')");
  if (opts.dir !== undefined && opts.dir !== 'ltr') throw new Error("comic(): dir: 'rtl' is not implemented yet (only 'ltr')");
  const panelIds = new Set<string>();
  const panels = sheet.panels.map(p => {
    const q = panelOf(p);
    if (panelIds.has(q.id)) throw new Error(`comic(): two panels have the id "${q.id}"`);
    panelIds.add(q.id);
    return q;
  });
  const copy: ComicWorksheet = {version: 1, title: sheet.title, layout: sheet.layout, cast: {...sheet.cast}, panels,
    ...(sheet.numbering === undefined ? {} : {numbering: sheet.numbering}), ...(sheet.labels === undefined ? {} : {labels: [...sheet.labels]}), ...(sheet.blank === undefined ? {} : {blank: sheet.blank})};
  const band: ComicBand = {type: 'comic', sheet: copy, ...(opts.aspect === undefined ? {} : {aspect: opts.aspect}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'comic()'), ...revealOf(opts)};
  return withHandle(band, opts.id);
}
