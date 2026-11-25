import {MAX_NODE_WIDTH, MAX_TREE_DEPTH, MAX_TREE_NODES, object, oneOf, treeItem, treeSize, withoutType} from '../spec-kit.ts';
import type {PartDef, Json, SpecIssue} from '../spec-kit.ts';

const NO_EDGE_LAYOUTS = ['brace', 'fishbone', 'timeline'];
/** ADR 0081 D3/D7: the errors of edge and tags that the schema cannot say, with the place in the spec. The messages are Japanese like the DSL's. */
function checkBranchStyle(part: Json, at: string, issues: SpecIssue[]): void {
  const layout = part['layout'], edgesOff = part['edges'] === false;
  const walk = (n: Json, path: string, isRoot: boolean): void => {
    if (n['edge'] !== undefined) {
      const label = String(n['label']);
      if (isRoot) issues.push({path: `${path}.edge`, message: `根(「${label}」)に edge は書けません(親がありません)。edge を消して、子の項目に書いてください`});
      else if (edgesOff) issues.push({path: `${path}.edge`, message: `「${label}」の edge は edges: false では描く線がないので使えません。edge を消すか、edges: false を外してください`});
      else if (typeof layout === 'string' && NO_EDGE_LAYOUTS.includes(layout)) issues.push({path: `${path}.edge`, message: `「${label}」の edge は layout: '${layout}' では使えません。edge を消すか、layout: 'right' などにしてください`});
    }
    if (Array.isArray(n['tags'])) (n['tags'] as unknown[]).forEach((t, i) => {
      const s = typeof t === 'string' ? t : (t as Json | null)?.['text'];
      if (typeof s !== 'string') return;
      if (!s.trim()) issues.push({path: `${path}.tags[${i}]`, message: '札の文字が空です。1 から 8 文字の文字を書くか、その札を消してください'});
      else if ([...s].length > 8) issues.push({path: `${path}.tags[${i}]`, message: `札「${s}」は ${[...s].length} 文字です(8 文字まで)。短くするか、補足は sub に書いてください`});
    });
    if (Array.isArray(n['children'])) (n['children'] as Json[]).forEach((c, i) => walk(c, `${path}.children[${i}]`, false));
  };
  const root = part['root'];
  if (root && typeof root === 'object') walk(root as Json, `${at}.root`, true);
}

export function defineMindmapPart<Result>(builder: (root: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'mindmap',
    description: "A mind map: one root with branches, for organising a topic. `layout` also gives an org chart ('org'), an indented list ('list'), a brace map ('brace'), a fishbone cause-and-effect chart ('fishbone') and a timeline ('timeline').",
    schema: object({
      type: {const: 'mindmap'},
      root: treeItem(MAX_TREE_DEPTH, true),
      layout: {...oneOf('radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'), description: 'How the branches are laid out (default radial).'},
      edges: {enum: ['elbow', 'curve', 'straight', false], description: 'How a branch line is drawn (default elbow); false for none.'},
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'root']),
    example: {type: 'mindmap', root: {label: '在庫管理アプリ', tone: 'accent', children: [{label: '目的', children: [{label: '棚卸しの時間を半分に'}, {label: '欠品の防止'}]}, {label: '機能', children: [{label: 'バーコード読み取り', tags: ['採用'], edge: {tone: 'accent'}}, {label: '発注点アラート', edge: {tone: 'danger', line: 'dashed'}, tags: [{text: '見送り', tone: 'danger'}]}]}]}},
    check(part, at, issues) {
      const n = treeSize(part['root'] as Json);
      if (n > MAX_TREE_NODES) issues.push({path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}`});
      checkBranchStyle(part, at, issues);
    },
    build(part) {
      const {root, ...opts} = withoutType(part);
      return builder(root as never, opts as never);
    },
  };
}
