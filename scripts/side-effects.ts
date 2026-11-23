// List lib modules with syntactically visible effects or unchecked work during initialization.
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as ts from 'typescript/unstable/ast';
import {API} from 'typescript/unstable/sync';

const pureCalls = ['Object.freeze', 'Object.fromEntries', 'Symbol', 'Symbol.for', 'RegExp', 'located'];
const pureConstructors = ['Map', 'Set', 'WeakMap', 'RegExp'];
const control = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement, ts.SyntaxKind.TryStatement, ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.WithStatement, ts.SyntaxKind.DebuggerStatement,
]);

function calleeName(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    return `${node.expression.text}.${node.name.text}`;
  }
  return undefined;
}

function needsReview(node: ts.Node): boolean {
  if (ts.isExpressionStatement(node)) return !ts.isStringLiteral(node.expression);
  if (ts.isCallExpression(node)) return !pureCalls.includes(calleeName(node.expression) ?? '');
  if (ts.isNewExpression(node)) return !pureConstructors.includes(calleeName(node.expression) ?? '');
  if (ts.isBinaryExpression(node)) return ts.isAssignmentOperator(node.operatorToken.kind);
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken;
  }
  return control.has(node.kind) || ts.isAwaitExpression(node) || ts.isDeleteExpression(node) ||
    ts.isTaggedTemplateExpression(node) || ts.isDecorator(node) || ts.isClassStaticBlockDeclaration(node);
}

function countSites(node: ts.Node): number {
  if (ts.isTypeNode(node)) return 0;
  if (ts.isParameterDeclaration(node)) {
    return node.modifiers?.filter(ts.isDecorator).length ?? 0;
  }
  let count = Number(needsReview(node));
  node.forEachChild(child => {
    // A declaration can evaluate decorators and computed names. Callable bodies and
    // instance field initializers wait for a call or an instance.
    if (ts.isFunctionLikeDeclaration(node) && child === node.body) return;
    if (ts.isPropertyDeclaration(node) && child === node.initializer &&
        !node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) return;
    count += countSites(child);
  });
  return count;
}

export function auditSideEffects(root: string): Map<string, number> {
  const lib = path.join(root, 'lib');
  const files = readdirSync(lib, {recursive: true, withFileTypes: true})
    .filter(file => file.isFile() && file.name.endsWith('.ts'))
    .map(file => path.join(file.parentPath, file.name)).sort();
  const api = new API({cwd: root});
  try {
    const config = path.join(root, 'tsconfig.json');
    const snapshot = api.updateSnapshot({openProjects: [config], openFiles: files});
    const sites = new Map<string, number>();
    for (const file of files) {
      const source = snapshot.getDefaultProjectForFile(file)?.program.getSourceFile(file);
      if (!source) throw new Error(`"${path.relative(root, file)}" の構文木を読めません。tsconfig.json とファイルを確認してください`);
      const count = countSites(source);
      if (count > 0) sites.set(path.relative(root, file).split(path.sep).join('/'), count);
    }
    return sites;
  } finally {
    api.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const sites = auditSideEffects(path.resolve(import.meta.dirname, '..'));
  console.table([...sites].map(([file, count]) => ({ファイル: file, 要確認箇所: count})));
}
