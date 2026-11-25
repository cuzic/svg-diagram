import {MAX_NODE_WIDTH, MAX_TREE_DEPTH, MAX_TREE_NODES, object, oneOf, treeItem, treeSize, withoutType} from '../spec-kit.ts';
import type {PartDef, Json} from '../spec-kit.ts';

export function defineMindmapPart<Result>(builder: (root: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'mindmap',
    description: "A mind map: one root with branches, for organising a topic. `layout` also gives an org chart ('org'), an indented list ('list'), a brace map ('brace'), a fishbone cause-and-effect chart ('fishbone') and a timeline ('timeline').",
    schema: object({
      type: {const: 'mindmap'},
      root: treeItem(MAX_TREE_DEPTH),
      layout: {...oneOf('radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'), description: 'How the branches are laid out (default radial).'},
      edges: {enum: ['elbow', 'curve', 'straight', false], description: 'How a branch line is drawn (default elbow); false for none.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'root']),
    example: {type: 'mindmap', root: {label: '在庫管理アプリ', tone: 'accent', children: [{label: '目的', children: [{label: '棚卸しの時間を半分に'}, {label: '欠品の防止'}]}, {label: '機能', children: [{label: 'バーコード読み取り'}, {label: '発注点アラート'}]}]}},
    check(part, at, issues) {
      const n = treeSize(part['root'] as Json);
      if (n > MAX_TREE_NODES) issues.push({path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}`});
    },
    build(part) {
      const {root, ...opts} = withoutType(part);
      return builder(root as never, opts as never);
    },
  };
}
