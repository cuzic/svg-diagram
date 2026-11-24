import {STEP_REF, flowSteps, items, list, object, oneOf, refIssue, text, withoutType} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineCyclePart<Result>(builder: (steps: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'cycle',
    description: 'Steps that repeat in a circle, such as PDCA: the last step leads back to the first. A word can sit in the centre. With links, the steps sit on a regular polygon joined pair by pair inside an optional named frame: the CBT five-part model.',
    schema: object({
      type: {const: 'cycle'},
      steps: flowSteps(3, 8),
      centre: text('A word in the middle.', 30),
      direction: {...oneOf('cw', 'ccw'), description: 'Clockwise (default) or counter-clockwise. Not with links.'},
      links: {oneOf: [{type: 'string', enum: ['all']}, list(object({
        from: STEP_REF('A step: a number from 1, its label or id.'),
        to: STEP_REF('Another step.'),
        label: text('The text on the link.', 20),
        direction: {...oneOf('both', 'forward'), description: 'both (default): arrows at both ends; forward: from -> to.'},
      }, ['from', 'to']), 28, 1)], description: "Instead of the arrows round the ring, the steps on a regular polygon (four on a square) joined pair by pair: 'all' (every pair, two-way; up to 6 steps) or the links to draw. The CBT five-part model (thoughts, emotions, body, behaviour)."},
      frame: text('A frame round the figure and its name, such as 状況・環境 or the situation itself.', 60),
    }, ['type', 'steps']),
    example: {type: 'cycle', steps: [{label: 'Plan'}, {label: 'Do'}, {label: 'Check'}, {label: 'Act'}], centre: '継続改善'},
    check(part, at, issues) {
      const steps = items(part, 'steps'), links = part['links'];
      if (links !== undefined && part['direction'] !== undefined) issues.push({path: `${at}.direction`, message: "turns the arrows round the ring; with links each link says its own (direction: 'forward')"});
      if (links === 'all' && steps.length > 6) issues.push({path: `${at}.links`, message: `'all' joins every pair of up to 6 steps (there are ${steps.length}); list the links instead`});
      // a step as a 0-based index (a number from 1, or a label / id), for the checks below
      const index = (v: unknown) => typeof v === 'number' ? v - 1 : steps.findIndex(x => x['label'] === v || x['id'] === v);
      const pairs = new Set<string>();
      if (Array.isArray(links)) items(part, 'links').forEach((l, i) => {
        const before = issues.length;
        for (const k of ['from', 'to']) refIssue(l[k], steps.length, steps, `${at}.links[${i}].${k}`, 'steps', issues);
        if (issues.length > before) return; // (a name that is no step, or two: which pair it joins is not known)
        const a = index(l['from']), b = index(l['to']);
        if (a < 0 || b < 0 || a >= steps.length || b >= steps.length) return;
        if (a === b) { issues.push({path: `${at}.links[${i}]`, message: 'joins a step to itself'}); return; }
        const key = `${Math.min(a, b)},${Math.max(a, b)}`;
        if (pairs.has(key)) issues.push({path: `${at}.links[${i}]`, message: "joins two steps another link already joins: keep one (it is two-way unless direction: 'forward')"});
        pairs.add(key);
      });
    },
    build(part) {
      const {steps, ...opts} = withoutType(part);
      return builder(steps as never, opts as never);
    },
  };
}
