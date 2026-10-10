#!/usr/bin/env node
// svg-diagram notes <source.ts> — print the figure's numbered notes as a Markdown list ("1. **題名**：本文"),
// ready to paste under the figure; `check --docs` compares such a list with the figure's own notes.
// A source with several annotated wireframes gets one list per screen, each after a <!-- 画面 N --> line.
import path from 'node:path';
import {register} from 'node:module';
const EXT = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
register(`./lib/resolve-hook.${EXT}`, import.meta.url);
const {notesOf, formatNotes} = await import('./lib/docs-check.ts');
const {loadConfig, applyConfig} = await import('./lib/config.ts');

const src = process.argv[2];
if (!src || src.startsWith('--')) { console.error('Usage: svg-diagram notes <diagram-source.ts>'); process.exit(2); }
const mod = await import(path.resolve(src));
if (typeof mod.default !== 'function') { console.error(`✗ ${src}: no default export function`); process.exit(1); }
const d = applyConfig(mod.default(), loadConfig());
const sets = notesOf(d.bands);
if (!sets.length) { console.error(`✗ ${src}: 注釈（notes）のあるワイヤーフレームがない`); process.exit(1); }
console.log(sets.map((s, i) => (sets.length > 1 ? `<!-- 画面 ${i + 1} -->\n` : '') + formatNotes(s)).join('\n\n'));
