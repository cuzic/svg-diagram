#!/usr/bin/env node
// svg-diagram notes <source.ts> — print the figure's numbered notes as a Markdown list ("1. **題名**：本文"),
// ready to paste under the figure; `check --docs` compares such a list with the figure's own notes.
// A source with several annotated wireframes gets one list per screen, each after a <!-- 画面 N --> line.
import path from 'node:path';
import { installResolveHook } from './lib/resolve-hook.js';
installResolveHook();
const { notesOf, formatNotes } = await import('./lib/docs-check.js');
const { loadDiagram } = await import('./lib/load-source.js');
const src = process.argv[2];
if (!src || src.startsWith('--')) {
    console.error('Usage: svg-diagram notes <diagram-source.ts>');
    process.exit(2);
}
const d = await loadDiagram(path.resolve(src)).catch(e => { console.error(`✗ ${src}: ${e.message}`); process.exit(1); });
const sets = notesOf(d.bands);
if (!sets.length) {
    console.error(`✗ ${src}: 注釈（notes）のあるワイヤーフレームがない`);
    process.exit(1);
}
console.log(sets.map((s, i) => (sets.length > 1 ? `<!-- 画面 ${i + 1} -->\n` : '') + formatNotes(s)).join('\n\n'));
