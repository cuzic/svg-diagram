// ADR 0073 U5 procedure (scratch worktrees under ~/src, never committed): orig = 456ef142 (main at PR #402), pre1 = 44e75344 (main before U1), now = main after U4 (538f81b7). Add the `__laid` line (pins-measure.ts header) to orig and pre1;
// copy test/helpers/random-crt.ts into them. node pins-measure.ts <root> 300 > res/<tag>-p.json ; ... 150 canvas > res/<tag>-c.json. Q3: a worktree of 538f81b7 + u5-layered-bound.patch, LMIN=bound|force (u5-bound.mjs). movedAside: + u5-movedaside.patch (NOMA=1). Jogs: u5-jogs.ts.
// ADR 0073 U5: sums and per-figure comparison of three versions. usage (in the directory that holds res/): node u5-compare.mjs <baseTag> <midTag> <nowTag>
// res/<tag>-<p|c>.json come from pins-measure.ts (300 plain / 150 canvas). Subsets: the ADR pinned range = plain g < 150, canvas g < 80; all = 300 / 150.
import fs from 'node:fs';
const [,, A, M, B] = process.argv, keys = ['c', 'cc', 'inAnd', 'pw', 'ov', 'b', 'h', 'lsd', 'laid'];
const rd = (t, k) => JSON.parse(fs.readFileSync(`res/${t}-${k}.json`)).out;
for (const [k, name, lim] of [['p', 'plain 1800', 150], ['p', 'plain 1800', 300], ['c', 'canvas', 80], ['c', 'canvas', 150]]) {
  const v = [A, M, B].map(t => rd(t, k)), ok = i => v.every(o => !o[i].err && o[i].g < lim);
  const idx = v[0].map((_, i) => i).filter(ok);
  console.log(`== ${name} first ${lim}: drawable ${idx.length}`);
  const sum = (o, q) => idx.reduce((s, i) => s + (o[i][q] ?? 0), 0);
  console.log('sums      ' + keys.map(q => `${q} ${v.map(o => sum(o, q)).join('/')}`).join('  '));
  for (const [from, to, fn, tn] of [[0, 2, A, B], [1, 2, M, B]]) {
    const o = [];
    for (const q of keys) { const up = idx.filter(i => v[to][i][q] > v[from][i][q]), dn = idx.filter(i => v[to][i][q] < v[from][i][q]);
      let ex = ''; if (q === 'b' && up.length) ex = ` maxUp +${Math.max(...up.map(i => v[to][i].b - v[from][i].b))}`;
      if (q === 'h' && up.length) ex = ` maxUp +${Math.max(...up.map(i => v[to][i].h - v[from][i].h))}px (${(100 * Math.max(...up.map(i => v[to][i].h / v[from][i].h - 1))).toFixed(0)}%)`;
      o.push(`${q}: up ${up.length} down ${dn.length}${ex}${q !== 'laid' && q !== 'h' && up.length && up.length <= 8 ? ' [#' + up.join(',#').replace(/#(\d+)/g, (_, n) => '#' + v[0][+n].g) + ']' : ''}`); }
    console.log(`${fn}->${tn} per figure: changed ${idx.filter(i => v[from][i].H !== v[to][i].H).length}; ` + o.join(' | '));
  }
  // crossings remaining, figures with crossings > 0 and distribution
  const cr = v[2], hist = {}; idx.forEach(i => { const c = cr[i].c; hist[c] = (hist[c] ?? 0) + 1; });
  console.log('now crossings histogram (value:figures): ' + Object.entries(hist).map(([a, b]) => `${a}:${b}`).join(' '));
}
