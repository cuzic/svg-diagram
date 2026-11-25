import {id, items, list, mustExist, object, oneOf, text, uniqueIds} from '../spec-kit.ts';
import {MAX_CAUSAL_NODES, MAX_CAUSAL_LINKS, MAX_CAUSAL_LOOPS, optionsOf, loopCount, POLARITY} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineCausalLoopPart<Result>(builder: (nodes: never, links: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'causalLoop',
    anchors: 'nodes',
    description: "A causal loop diagram (systems thinking): variables joined by arrows marked + (they move the same way) or - (the opposite way); a delay is marked ||. Every closed loop is found and named R (reinforcing: an even number of -) or B (balancing: odd). Interventions are levers outside the loops, acting on a variable. layout 'ring' draws a figure that is exactly one loop as a circle.",
    schema: object({
      type: {const: 'causalLoop'},
      nodes: list(object({id: id('Referred to by links.'), label: text('A variable: something that can rise or fall.', 30)}, ['id', 'label']), MAX_CAUSAL_NODES, 2),
      links: list(object({from: id('A node id.'), to: id('A node id.'), polarity: POLARITY, delay: {type: 'boolean', description: 'true: the effect comes late (||).'}, label: text('A short note on the arrow.', 20)}, ['from', 'to', 'polarity']), MAX_CAUSAL_LINKS, 1),
      interventions: list(object({id: id('A name for the lever.'), label: text('The lever.', 30), to: {oneOf: [id('A node id.'), {type: 'array', items: id('A node id.'), minItems: 1, maxItems: 3}]}, polarity: POLARITY, delay: {type: 'boolean'}}, ['id', 'label', 'to', 'polarity']), 3),
      layout: {...oneOf('layered', 'ring'), description: 'layered (default), or ring for a figure that is exactly one loop.'},
      direction: {...oneOf('LR', 'TB'), description: 'LR (default): left to right; TB: top to bottom.'},
    }, ['type', 'nodes', 'links']),
    example: {type: 'causalLoop', nodes: [{id: 'q', label: 'サービス品質'}, {id: 's', label: '顧客満足'}, {id: 'o', label: '受注量'}, {id: 'l', label: '業務負荷'}], links: [{from: 'q', to: 's', polarity: '+'}, {from: 's', to: 'o', polarity: '+', delay: true}, {from: 'o', to: 'l', polarity: '+'}, {from: 'l', to: 'q', polarity: '-'}]},
    check(part, at, issues) {
      const before = issues.length, nodes = uniqueIds(part, 'nodes', at, issues), seen = new Set<string>();
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        const key = `${String(l['from'])}>${String(l['to'])}`;
        if (seen.has(key)) issues.push({path: `${at}.links[${i}]`, message: 'repeats an earlier link'});
        seen.add(key);
      });
      items(part, 'interventions').forEach((v, i) => {
        if (nodes.has(v['id'] as string)) issues.push({path: `${at}.interventions[${i}].id`, message: `"${String(v['id'])}" is already a node id`});
        const to = v['to'];
        (Array.isArray(to) ? to : [to]).forEach((t, j) => mustExist(t, nodes, Array.isArray(to) ? `${at}.interventions[${i}].to[${j}]` : `${at}.interventions[${i}].to`, 'node id', issues));
      });
      if (part['layout'] === 'ring' && part['direction'] !== undefined) issues.push({path: `${at}.direction`, message: 'does not go with layout ring'});
      if (issues.length > before) return;
      const loops = loopCount(items(part, 'nodes').map(n => n['id'] as string), items(part, 'links'), MAX_CAUSAL_LOOPS);
      if (loops > MAX_CAUSAL_LOOPS) issues.push({path: `${at}.links`, message: `make more than ${MAX_CAUSAL_LOOPS} loops; draw the main loops only (each loop is named and drawn)`});
    },
    build(part) {
      const {nodes, links, ...opts} = optionsOf(part);
      return builder(nodes as never, links as never, opts as never);
    },
  };
}
