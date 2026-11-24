import {id, items, list, object, oneOf, text, uniqueIds} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {MAX_DEPENDENCY_NODES, MAX_DEPENDENCY_EDGES, EN_MARK, english, withoutMarks, checkEnds} from './r3-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineDependencyNetworkPart<Result>(builder: (nodes: never, edges: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'dependencyNetwork',
    anchors: 'nodes',
    description: 'A dependency network: things (services, modules, teams) and typed arrows between them: depends, uses, blocks or relates. A node kind and each arrow type are named in a legend; a weight thickens the arrow.',
    schema: object({
      type: {const: 'dependencyNetwork'},
      nodes: list(object({id: id('Referred to by edges.'), label: text('The thing.', 30), kind: text('Its kind, named in the legend (nodes of a kind share a colour). At most 4 kinds, or 3 when some nodes have none.', 20)}, ['id', 'label']), MAX_DEPENDENCY_NODES, 1),
      edges: list(object({
        from: id('A node id.'),
        to: id('A node id.'),
        type: {...oneOf('depends', 'uses', 'blocks', 'relates'), description: 'The kind of arrow, each drawn differently.'},
        weight: {type: 'number', minimum: 0, maximum: 30, description: 'Thickens the arrow (and is written on it).'},
        label: text('The text on the arrow (default: the name of its type).', 30),
      }, ['from', 'to', 'type']), MAX_DEPENDENCY_EDGES),
      typeLabels: object({depends: text('', 20), uses: text('', 20), blocks: text('', 20), relates: text('', 20)}, [], 'The names of the arrow types in the legend (default 依存する, 利用する, 阻害する, 関連する).'),
      direction: {...oneOf('LR', 'TB'), description: 'LR: left to right (default); TB: top to bottom.'},
    }, ['type', 'nodes', 'edges']),
    example: {type: 'dependencyNetwork', nodes: [{id: 'web', label: 'Web 画面', kind: '画面'}, {id: 'api', label: '注文 API', kind: 'サービス'}, {id: 'db', label: '注文 DB', kind: 'データ'}], edges: [{from: 'web', to: 'api', type: 'uses'}, {from: 'api', to: 'db', type: 'depends'}]},
    en: {[EN_MARK]: 'en'},
    check(part, at, issues) {
      const nodes = uniqueIds(part, 'nodes', at, issues);
      checkEnds(part, at, 'edges', nodes, 'node id', issues);
      items(part, 'edges').forEach((e, i) => { if (e['from'] === e['to'] && typeof e['from'] === 'string') issues.push({path: `${at}.edges[${i}].to`, message: 'is the node the arrow starts at'}); });
      // four colours tell kinds apart, and a node with no kind takes the fourth
      const kinds = [...new Set(items(part, 'nodes').flatMap(n => typeof n['kind'] === 'string' ? [n['kind']] : []))];
      const room = items(part, 'nodes').some(n => n['kind'] === undefined) ? 3 : 4;
      if (kinds.length > room) issues.push({path: `${at}.nodes`, message: `use ${kinds.length} kinds (${kinds.join(', ')}); at most ${room} can be told apart by colour${room === 3 ? ' while some nodes have no kind' : ''}`});
    },
    build(part) {
      const {nodes, edges, typeLabels, ...opts} = withoutMarks(part);
      const names = english(part) ? {depends: 'depends on', uses: 'uses', blocks: 'blocks', relates: 'relates to'} : {depends: '依存する', uses: '利用する', blocks: '阻害する', relates: '関連する'};
      return builder(nodes as never, edges as never, {...opts, edgeTypes: {...names, ...(typeLabels as Json | undefined)}} as never);
    },
  };
}
