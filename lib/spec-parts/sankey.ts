import {AMOUNT, CHART_TONE, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType} from '../spec-kit.ts';
import {unit, positive} from './r2-common.ts';
import type {PartDef} from '../spec-kit.ts';

const MAX_SANKEY_NODES = 20, MAX_SANKEY_LINKS = 40;

export function defineSankeyPart<Result>(builder: (nodes: never, links: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'sankey',
    anchors: 'nodes',
    description: 'A Sankey diagram: flows between stages, such as visitors to purchases or a budget to its uses. The height of a node and the thickness of a ribbon follow the value. Flows go one way: no cycles.',
    schema: object({
      type: {const: 'sankey'},
      nodes: list(object({id: id('Referred to by links.'), label: text('The name of the node.', 30), tone: CHART_TONE}, ['id']), MAX_SANKEY_NODES, 2),
      links: list(object({
        from: id('A node id.'), to: id('A node id.'),
        value: {...AMOUNT, description: 'The amount that flows: more than 0.'},
        tone: {...oneOf('accent', 'danger', 'muted'), description: 'danger: a flow to watch (dashed outline too).'},
      }, ['from', 'to', 'value']), MAX_SANKEY_LINKS, 1),
      unit: unit(),
      align: {...oneOf('justify', 'left'), description: 'justify (default): the end nodes all on the right. left: each where its path ends.'},
      linkLabels: {type: 'boolean', description: 'false: no values on the ribbons. values: false turns them off too (linkLabels: true does not bring them back).'},
      values: {type: 'boolean', description: 'false: names only, no values on the nodes or the ribbons (the widths still follow the values).'},
    }, ['type', 'nodes', 'links']),
    example: {type: 'sankey', unit: '千人', nodes: [{id: 'ad', label: '広告'}, {id: 'seo', label: '検索'}, {id: 'visit', label: '訪問'}, {id: 'buy', label: '購入', tone: 'accent'}, {id: 'leave', label: '離脱', tone: 'muted'}], links: [{from: 'ad', to: 'visit', value: 60}, {from: 'seo', to: 'visit', value: 40}, {from: 'visit', to: 'buy', value: 15}, {from: 'visit', to: 'leave', value: 85, tone: 'muted'}]},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      const seen = new Set<string>();
      const next = new Map<string, string[]>();
      items(part, 'links').forEach((l, i) => {
        mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
        mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
        positive(l['value'], `${at}.links[${i}].value`, 'a flow', issues);
        if (l['from'] === l['to']) issues.push({path: `${at}.links[${i}].to`, message: 'is the same node as from: a flow goes from one node to another'});
        const key = `${String(l['from'])}\u0000${String(l['to'])}`;
        if (seen.has(key)) issues.push({path: `${at}.links[${i}]`, message: `repeats the flow from "${String(l['from'])}" to "${String(l['to'])}": add the two values`});
        seen.add(key);
        if (typeof l['from'] === 'string' && typeof l['to'] === 'string') next.set(l['from'], [...(next.get(l['from']) ?? []), l['to']]);
      });
      // a cycle has no left-to-right order
      const state = new Map<string, 1 | 2>();
      const visit = (n: string): boolean => {
        if (state.get(n) === 2) return false;
        if (state.get(n) === 1) return true;
        state.set(n, 1);
        const cyc = (next.get(n) ?? []).some(visit);
        state.set(n, 2);
        return cyc;
      };
      if ([...next.keys()].some(visit)) issues.push({path: `${at}.links`, message: 'make a cycle: a Sankey diagram flows one way, so drop or reverse the link that leads back'});
      const used = new Set(items(part, 'links').flatMap(l => [l['from'], l['to']]));
      items(part, 'nodes').forEach((n, i) => { if (typeof n['id'] === 'string' && !used.has(n['id'])) issues.push({path: `${at}.nodes[${i}]`, message: `"${n['id']}" has no link: remove it or link it`}); });
    },
    build(part) {
      const {nodes, links, ...opts} = withoutType(part);
      return builder(nodes as never, links as never, opts as never);
    },
  };
}
