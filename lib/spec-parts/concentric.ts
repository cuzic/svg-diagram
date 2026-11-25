import {STEP_REF, TEXT_TONE, items, list, object, oneOf, refIssue, text, withoutType} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineConcentricPart<Result>(builder: (rings: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'concentric',
    description: 'Concentric circles: layers around a centre, such as stakeholders by distance, defence in depth or a core and its surroundings. labels: side writes each ring\'s name and description beside the circles. With sectors, the rings are cut into sectors and carry marks: the ACT Values Bullseye (life domains as sectors, how closely the week followed each value as the distance from the centre), a technology radar (Adopt / Trial / Assess / Hold as rings). A mark sits in a sector at a ring or at r (0 centre .. 1 edge); from (last time\'s ring or r) draws an arrow from where it was. layout: stack draws the same data as a column of boxes per sector, the innermost ring the top row.',
    schema: object({
      type: {const: 'concentric'},
      rings: {oneOf: [list(object({label: text('The ring.', 24), description: text('What it holds (with labels: side).', 60), tone: TEXT_TONE, id: text('An id to connect or spotlight it.', 40)}, ['label']), 6, 1), {type: 'integer', minimum: 1, maximum: 6}], description: 'The rings (2 or more without sectors), or with sectors how many plain rings.'},
      order: {...oneOf('outer-first', 'inner-first'), description: 'Which ring the list starts with (default outer-first). A mark\'s ring number counts in this order.'},
      labels: {...oneOf('inside', 'side'), description: 'inside (default): names in the rings. side: names and descriptions beside them (not with sectors).'},
      centre: text('The word in the middle.', 20),
      sectors: list(object({label: text('The sector, such as a life domain.', 24), id: text('An id to connect or spotlight it.', 40)}, ['label']), 8, 1),
      marks: list(object({
        label: text('The mark: what was done, not just a date.', 30),
        sector: STEP_REF('Its sector: a number from 1 (clockwise from 12 o\'clock), or its label or id.'),
        ring: STEP_REF('Its ring: a number from 1 in the order rings are written, or its name.'),
        r: {type: 'number', minimum: 0, maximum: 1, description: 'The distance from the centre, 0 (centre) to 1 (outer edge), instead of a ring.'},
        tone: TEXT_TONE,
        id: text('An id to connect or spotlight it.', 40),
        from: object({ring: STEP_REF('Last time\'s ring.'), r: {type: 'number', minimum: 0, maximum: 1, description: 'Last time\'s distance.'}, sector: STEP_REF('Last time\'s sector, when it changed.')}, [], 'Where it was last time: an arrow is drawn from there.'),
      }, ['label', 'sector']), 24),
      layout: {...oneOf('circle', 'stack'), description: 'With sectors: circle (default) cuts the rings into sectors; stack draws a column of boxes per sector, a row per ring with the innermost at the top (the centre word heads the columns).'},
      fromLegend: {oneOf: [{type: 'array', items: text('A word of the key.', 16), minItems: 2, maxItems: 2}, {type: 'boolean', enum: [false]}], description: "The key under the figure when a mark has from: [where it was, where it is] (default ['前回', '今回']); false for none."},
    }, ['type', 'rings']),
    example: {type: 'concentric', order: 'inner-first', labels: 'side', centre: '利用者', rings: [{label: 'チーム'}, {label: '顧客と取引先'}, {label: '社会'}]},
    en: {fromLegend: ['Last time', 'Now']},
    check(part, at, issues) {
      const rings = part['rings'], sectors = items(part, 'sectors'), n = typeof rings === 'number' ? rings : Array.isArray(rings) ? rings.length : 0;
      if (part['labels'] !== 'side' && Array.isArray(rings)) items(part, 'rings').forEach((r, i) => { if (r['description'] !== undefined) issues.push({path: `${at}.rings[${i}].description`, message: sectors.length ? "is written in the side key only, which sectors do not have: leave it out" : "is drawn only with labels: 'side'"}); });
      if (!sectors.length) {
        if (typeof rings === 'number') issues.push({path: `${at}.rings`, message: 'is a number only with sectors; otherwise name each ring'});
        else if (Array.isArray(rings) && rings.length < 2) issues.push({path: `${at}.rings`, message: 'needs 2 or more rings (or sectors)'});
        if (part['marks'] !== undefined) issues.push({path: `${at}.marks`, message: 'needs sectors'});
        if (part['layout'] === 'stack') issues.push({path: `${at}.layout`, message: 'stack draws the sectors as columns: give sectors too'}); // (fromLegend without sectors draws nothing: lang: 'en' gives it to every concentric)
        return;
      }
      if (part['labels'] === 'side') issues.push({path: `${at}.labels`, message: "with sectors the ring names go along the 12 o'clock cut: leave labels out"});
      const ringList = Array.isArray(rings) ? rings as Json[] : [];
      // a mark names its sector / ring by label: two with one label could not be told apart
      for (const [k, xs] of [['sectors', sectors], ['rings', ringList]] as const) {
        const seen = new Set<unknown>();
        xs.forEach((x, i) => { if (seen.has(x['label'])) issues.push({path: `${at}.${k}[${i}].label`, message: `${JSON.stringify(x['label'])} is used twice (a mark names it by label)`}); seen.add(x['label']); });
      }
      items(part, 'marks').forEach((m, i) => {
        const p = `${at}.marks[${i}]`;
        refIssue(m['sector'], sectors.length, sectors, `${p}.sector`, 'sectors', issues);
        if (m['ring'] === undefined && m['r'] === undefined) issues.push({path: p, message: 'needs a ring (a number from 1, or its name) or r (0..1)'});
        if (m['ring'] !== undefined && m['r'] !== undefined) issues.push({path: `${p}.r`, message: 'give a ring or r, not both'});
        refIssue(m['ring'], n, ringList, `${p}.ring`, 'rings', issues);
        const f = m['from'] as Json | undefined;
        if (f) {
          if (f['ring'] === undefined && f['r'] === undefined) issues.push({path: `${p}.from`, message: 'needs a ring or r (where it was)'});
          if (f['ring'] !== undefined && f['r'] !== undefined) issues.push({path: `${p}.from.r`, message: 'give a ring or r, not both'});
          refIssue(f['ring'], n, ringList, `${p}.from.ring`, 'rings', issues);
          refIssue(f['sector'], sectors.length, sectors, `${p}.from.sector`, 'sectors', issues);
        }
      });
    },
    build(part) {
      const {rings, ...opts} = withoutType(part);
      if (opts['sectors'] === undefined) delete opts['fromLegend']; // lang: 'en' gives every concentric the key's words; only one with marks draws them
      return builder(rings as never, opts as never);
    },
  };
}
