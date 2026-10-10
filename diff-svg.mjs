#!/usr/bin/env node
// svg-diagram diff old.svg new.svg — what changed between two generated SVGs, in words.
// Exit 0 when nothing visible changed (identical, or metadata / invisible backing only), 1 when the picture changes.
import fs from 'node:fs';
import {explainChange} from './lib/svg-diff.mjs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('Usage: svg-diagram diff old.svg new.svg'); process.exit(2); }
const r = explainChange(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8'));
for (const l of r.lines) console.log(l);
console.log(r.identical ? '→ 同一' : r.visual ? '→ 見た目が変わる' : '→ 見た目は変わらない');
process.exit(r.visual ? 1 : 0);
