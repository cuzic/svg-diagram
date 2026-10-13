// A ratchet toward `noUncheckedIndexedAccess`: tsconfig.index.json turns it on, and the files that still
// have errors are listed in scripts/index-access-debt.txt. A file off the list must stay clean; a listed
// file that has become clean must be taken off the list (so the debt only shrinks).
// `node scripts/check-index-access.ts --write` rewrites the list from the current errors.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const LIST = 'scripts/index-access-debt.txt';
const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.index.json', '--noEmit', '--pretty', 'false'], {encoding: 'utf8', maxBuffer: 1 << 29});
const bad = new Map<string, number>();
for (const m of (r.stdout ?? '').matchAll(/^(\S.*?)\(\d+,\d+\): error TS/gm)) bad.set(m[1], (bad.get(m[1]) ?? 0) + 1);

if (process.argv.includes('--write')) {
  fs.writeFileSync(LIST, [...bad.keys()].sort().join('\n') + '\n');
  console.log(`${bad.size} files with ${[...bad.values()].reduce((a, b) => a + b, 0)} errors written to ${LIST}`);
  process.exit(0);
}
const debt = new Set(fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean));
const fresh = [...bad.keys()].filter(f => !debt.has(f));
const paid = [...debt].filter(f => !bad.has(f));
for (const f of fresh) console.error(`${f}: ${bad.get(f)} unchecked-index error(s) (this file is not on the debt list)`);
for (const f of paid) console.error(`${f}: clean now — remove it from ${LIST}`);
if (fresh.length || paid.length) process.exit(1);
console.log(`noUncheckedIndexedAccess: ${debt.size} files still on the debt list`);
