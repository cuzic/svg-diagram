import { LINE, MAX_NODE_WIDTH, MAX_TREE_DEPTH, MAX_TREE_NODES, list, object, oneOf, treeItem, treeSize, withoutType } from '../spec-kit.js';
/** ADR 0081 D7: what only a mind map's items take. maxLength is in UTF-16 units (16); the 8 code points are checked by the part's check(). A blank tag and a root `edge` are caught by the schema (minLength / not a known field), so check() does not repeat them. */
const branchStyle = (levels) => {
    const long = levels === MAX_TREE_DEPTH - 1; // the descriptions only at the first child level: the deeper levels repeat the same fields
    const d = (description) => long ? { description } : {};
    const TAG_TONE = oneOf('accent', 'muted', 'danger');
    const tagText = { type: 'string', minLength: 1, maxLength: 16, ...d('A tag (8 characters at most).') };
    const tags = list({ oneOf: [tagText, object({ text: { ...tagText }, tone: TAG_TONE }, ['text'])] }, 3);
    if (levels >= MAX_TREE_DEPTH)
        return { tags }; // the root has no line to a parent, so no edge
    return {
        edge: { ...object({ tone: { ...TAG_TONE, ...d('The colour of the line to the parent (default muted): accent for a pro, danger for a con.') }, line: { ...LINE, ...d('The line to the parent (default solid).') } }, []), ...d('How the line from the parent to this node looks. Not with edges: false or layout brace, fishbone or timeline.') },
        tags,
    };
};
const NO_EDGE_LAYOUTS = ['brace', 'fishbone', 'timeline'];
/** ADR 0081 D3/D7: the errors of edge and tags that the schema cannot say, with the place in the spec. The messages are Japanese like the DSL's. */
function checkBranchStyle(part, at, issues) {
    const layout = part['layout'], edgesOff = part['edges'] === false;
    const walk = (n, path) => {
        if (n['edge'] !== undefined) {
            const label = String(n['label']);
            if (edgesOff)
                issues.push({ path: `${path}.edge`, message: `「${label}」の edge は edges: false では描く線がないので使えません。edge を消すか、edges: false を外してください` });
            else if (typeof layout === 'string' && NO_EDGE_LAYOUTS.includes(layout))
                issues.push({ path: `${path}.edge`, message: `「${label}」の edge は layout: '${layout}' では使えません。edge を消すか、layout: 'right' などにしてください` });
        }
        if (Array.isArray(n['tags']))
            n['tags'].forEach((t, i) => {
                const s = typeof t === 'string' ? t : t?.['text'];
                if (typeof s !== 'string')
                    return;
                if ([...s].length > 8)
                    issues.push({ path: `${path}.tags[${i}]`, message: `札「${s}」は ${[...s].length} 文字です(8 文字まで)。短くするか、補足は sub に書いてください` });
            });
        if (Array.isArray(n['children']))
            n['children'].forEach((c, i) => walk(c, `${path}.children[${i}]`));
    };
    const root = part['root'];
    if (root && typeof root === 'object')
        walk(root, `${at}.root`);
}
export function defineMindmapPart(builder) {
    return {
        type: 'mindmap',
        description: "A mind map: one root with branches, for organising a topic. `layout` also gives an org chart ('org'), an indented list ('list'), a brace map ('brace'), a fishbone cause-and-effect chart ('fishbone') and a timeline ('timeline').",
        schema: object({
            type: { const: 'mindmap' },
            root: treeItem(MAX_TREE_DEPTH, branchStyle),
            layout: { ...oneOf('radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'), description: 'How the branches are laid out (default radial).' },
            edges: { enum: ['elbow', 'curve', 'straight', false], description: 'How a branch line is drawn (default elbow); false for none.' },
            maxNodeW: MAX_NODE_WIDTH,
        }, ['type', 'root']),
        example: { type: 'mindmap', root: { label: '在庫管理アプリ', tone: 'accent', children: [{ label: '目的', children: [{ label: '棚卸しの時間を半分に' }, { label: '欠品の防止' }] }, { label: '機能', children: [{ label: 'バーコード読み取り', tags: ['採用'], edge: { tone: 'accent' } }, { label: '発注点アラート', edge: { tone: 'danger', line: 'dashed' }, tags: [{ text: '見送り', tone: 'danger' }] }] }] } },
        check(part, at, issues) {
            const n = treeSize(part['root']);
            if (n > MAX_TREE_NODES)
                issues.push({ path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}` });
            checkBranchStyle(part, at, issues);
        },
        build(part) {
            const { root, ...opts } = withoutType(part);
            return builder(root, opts);
        },
    };
}
