// comic() and speechBubble() (ADR 0074 D1 / D2): the meaning-first data of a comic with blanks. The data holds no coordinates and no sizes; the layout works
// them out (lib/comic/). The constructors throw on what cannot be drawn at all (an unknown layout, a malformed id or template); what a worksheet may
// get wrong and still be drawn (a speaker not on the stage, too many lines) is a finding of the check, not an error here.
import { COMIC_ID, parseTemplate } from '../comic/template.js';
import { EXPRESSIONS, loadCharacter } from '../comic/character.js';
import { revealOf, scopeOpt, withHandle } from './shared.js';
const LAYOUTS = ['1x4', '2x2', '1x3', '1x2'];
const KINDS = ['say', 'think', 'shout', 'narration'];
const ATS = ['left', 'center', 'right'];
const ASPECTS = ['7:5', '6:5', '1:1'];
const assertId = (id, what) => {
    if (typeof id !== 'string' || !COMIC_ID.test(id))
        throw new Error(`${what}: id ${JSON.stringify(id)} must be letters, digits, _ and - (starting with a letter; no . : @ #)`);
    return id;
};
const oneOf = (v, list, what) => {
    if (!list.includes(v))
        throw new Error(`${what}: ${JSON.stringify(v)} is not one of ${list.join(' / ')}`);
    return v;
};
/**
 * One line of speech (ADR 0074 calls it bubble(); that name is the bubble chart's): a template with blanks (`{id}`) and who says it. The shape is shared with chat().
 *   speechBubble({id: 'd1', who: 'me', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}})
 */
export function speechBubble(d) {
    assertId(d.id, 'speechBubble()');
    oneOf(d.kind, KINDS, `speechBubble() ${d.id}: kind`);
    if (d.who !== undefined)
        assertId(d.who, `speechBubble() ${d.id}: who`);
    else if (d.kind !== 'narration')
        throw new Error(`speechBubble() ${d.id}: who is the speaker (a key of cast); only a narration has none`);
    if (typeof d.tpl !== 'string' || d.tpl === '')
        throw new Error(`speechBubble() ${d.id}: tpl is the text, with {id} for a blank`);
    parseTemplate(d.tpl, `speechBubble() ${d.id}`);
    const slots = {};
    for (const [sid, def] of Object.entries(d.slots ?? {})) {
        assertId(sid, `speechBubble() ${d.id}: slots`);
        slots[sid] = { ...def, ...(def.choices === undefined ? {} : { choices: [...def.choices] }) };
    }
    return { id: d.id, ...(d.who === undefined ? {} : { who: d.who }), kind: d.kind, tpl: d.tpl, ...(d.slots === undefined ? {} : { slots }) };
}
function panelOf(p) {
    assertId(p.id, 'comic(): panel');
    if (!Array.isArray(p.stage) || !Array.isArray(p.dialogue))
        throw new Error(`comic(): panel ${p.id} needs stage and dialogue (lists)`);
    const ids = new Set();
    const dialogue = p.dialogue.map(d => {
        const b = speechBubble(d);
        if (ids.has(b.id))
            throw new Error(`comic(): panel ${p.id} has two dialogue ids "${b.id}"`);
        ids.add(b.id);
        return b;
    });
    const stage = p.stage.map(s => ({ who: assertId(s.who, `comic(): panel ${p.id} stage`), at: oneOf(s.at, ATS, `comic(): panel ${p.id} stage at`), expression: oneOf(s.expression, EXPRESSIONS, `comic(): panel ${p.id} stage expression`) }));
    return { id: p.id, ...(p.bg === undefined ? {} : { bg: { ...p.bg } }), ...(p.thumb === undefined ? {} : { thumb: p.thumb }), stage, dialogue };
}
export function comic(sheet, opts = {}) {
    if (!sheet || typeof sheet !== 'object')
        throw new Error('comic(sheet) needs the worksheet: {version, title, layout, cast, panels}');
    if (sheet.version !== 1)
        throw new Error(`comic(): version must be 1 (got ${JSON.stringify(sheet.version)})`);
    if (typeof sheet.title !== 'string' || sheet.title === '')
        throw new Error('comic(): title is the name of the comic');
    oneOf(sheet.layout, LAYOUTS, 'comic(): layout');
    if (!sheet.cast || typeof sheet.cast !== 'object')
        throw new Error('comic(): cast is {id: {name}} of the people');
    for (const [k, c] of Object.entries(sheet.cast)) {
        assertId(k, 'comic(): cast');
        const f = c?.face;
        if (f !== undefined) {
            if (!f || !Number.isInteger(f.hue) || f.hue < 0 || f.hue > 359)
                throw new Error(`comic(): cast の "${k}" の face.hue に 0〜359 の整数を指定してください`);
            if (f.hair !== undefined && f.hair !== 'short' && f.hair !== 'long')
                throw new Error(`comic(): cast の "${k}" の face.hair に short か long を指定してください`);
        }
        if (c?.asset !== undefined)
            assertId(c.asset, `comic(): cast ${k}: asset`);
    }
    if (!Array.isArray(sheet.panels))
        throw new Error('comic(): panels is a list');
    if (opts.aspect !== undefined)
        oneOf(opts.aspect, ASPECTS, 'comic(): aspect');
    if (opts.writing !== undefined && opts.writing !== 'horizontal')
        throw new Error("comic(): writing: 'vertical' is not implemented yet (only 'horizontal')");
    if (opts.dir !== undefined && opts.dir !== 'ltr')
        throw new Error("comic(): dir: 'rtl' is not implemented yet (only 'ltr')");
    const panelIds = new Set();
    const panels = sheet.panels.map(p => {
        const q = panelOf(p);
        if (panelIds.has(q.id))
            throw new Error(`comic(): two panels have the id "${q.id}"`);
        panelIds.add(q.id);
        return q;
    });
    const copy = { version: 1, title: sheet.title, layout: sheet.layout, cast: { ...sheet.cast }, panels,
        ...(sheet.numbering === undefined ? {} : { numbering: sheet.numbering }), ...(sheet.labels === undefined ? {} : { labels: [...sheet.labels] }), ...(sheet.blank === undefined ? {} : { blank: sheet.blank }) };
    const characters = Object.fromEntries(Object.entries(opts.characters ?? {}).map(([key, manifest]) => {
        const character = loadCharacter(manifest);
        if (character.id !== key)
            throw new Error(`comic(): characters のキー "${key}" を素材の id "${character.id}" に合わせてください`);
        return [key, character];
    }));
    const band = { type: 'comic', sheet: copy, ...(Object.keys(characters).length ? { characters } : {}), ...(opts.aspect === undefined ? {} : { aspect: opts.aspect }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'comic()'), ...revealOf(opts) };
    return withHandle(band, opts.id);
}
