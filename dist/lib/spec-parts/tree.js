import { MAX_NODE_WIDTH, MAX_TREE_DEPTH, MAX_TREE_NODES, object, oneOf, treeItem, treeSize } from '../spec-kit.js';
import { withoutMarks } from './r3-common.js';
export function defineTreePart(builder) {
    return {
        type: 'tree',
        description: 'A tree of boxes joined by lines, such as an organization, a breakdown of work (WBS) or a category hierarchy: the root at the top (or the left with dir right), each node with its children below it.',
        schema: object({
            type: { const: 'tree' },
            root: treeItem(MAX_TREE_DEPTH),
            dir: { ...oneOf('down', 'right', 'auto'), description: 'down: top to bottom (default, turning when it does not fit); right: left to right, for many siblings.' },
            maxNodeW: MAX_NODE_WIDTH,
        }, ['type', 'root']),
        example: { type: 'tree', root: { label: 'Web サイト刷新', tone: 'accent', children: [{ label: '設計', children: [{ label: '情報設計' }, { label: 'デザイン' }] }, { label: '開発', children: [{ label: '画面' }, { label: 'CMS' }] }, { label: '公開', children: [{ label: '移行' }] }] } },
        check(part, at, issues) {
            const n = treeSize(part['root']);
            if (n > MAX_TREE_NODES)
                issues.push({ path: `${at}.root`, message: `has ${n} nodes; the limit is ${MAX_TREE_NODES}` });
        },
        build(part) {
            const { root, ...opts } = withoutMarks(part);
            return builder(root, opts);
        },
    };
}
