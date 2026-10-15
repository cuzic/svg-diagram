// An outside judge for geom.ts: the same preset + xfrm, written as an ordinary p:sp (no connector logic), is drawn by LibreOffice's
// custom-shape engine; pdftocairo -svg gives back the path that was drawn. Compared with the polyline the xfrm was fitted to.
// usage: node spike/pptx/judge-geom.ts <outdir>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {packPptx} from './run.ts';
import {fitConnector, maxDeviation, simplify, EMU, type Pt} from './geom.ts';

const out = process.argv[2]!;
fs.mkdirSync(out, {recursive: true});
const LEN = [60, 90, 120, 70, 100];
interface Case {name: string; pts: Pt[]; color: string}
const cases: Case[] = [];
const CELL = 400, COLS = 10;
for (let n = 1; n <= 5; n++) for (const startH of [true, false]) for (let mask = 0; mask < 1 << n; mask++) {
  const idx = cases.length;
  const ox = (idx % COLS) * CELL + CELL / 2, oy = Math.floor(idx / COLS) * CELL + CELL / 2;
  const pts: Pt[] = [{x: ox, y: oy}];
  let h = startH;
  for (let i = 0; i < n; i++) {
    const sgn = mask & (1 << i) ? -1 : 1, p = pts[i]!, l = sgn * LEN[i]!;
    pts.push(h ? {x: p.x + l, y: p.y} : {x: p.x, y: p.y + l});
    h = !h;
  }
  // a colour per case, far enough apart that cairo's percent rounding cannot confuse two of them
  const col = [10 + (idx % 16) * 15, 10 + Math.floor(idx / 16) * 30, 60];
  cases.push({name: `n${n}-${startH ? 'H' : 'V'}-${mask}`, pts, color: col.map(v => v.toString(16).padStart(2, '0')).join('')});
}
// degenerate ones (the end lies on the start's axis): U / C shapes, as loop-under and the cause tree's outer-lane returns draw them
const deg: [string, [number, number][]][] = [
  ['U-under', [[0, 0], [0, 40], [120, 40], [120, 0]]],
  ['U-over', [[0, 0], [0, -40], [120, -40], [120, 0]]],
  ['C-left', [[0, 0], [-40, 0], [-40, 120], [0, 120]]],
  ['C-right', [[0, 0], [40, 0], [40, 120], [0, 120]]],
  ['C5-out', [[0, 0], [-30, 0], [-30, 90], [150, 90], [150, 0]]],
  ['S5', [[0, 0], [0, 50], [-70, 50], [-70, 110], [0, 110]]],
];
for (const [name, rel] of deg) {
  const idx = cases.length;
  const ox = (idx % COLS) * CELL + CELL / 2, oy = Math.floor(idx / COLS) * CELL + CELL / 2;
  const col = [10 + (idx % 16) * 15, 10 + Math.floor(idx / 16) * 30, 60];
  cases.push({name, pts: rel.map(([x, y]) => ({x: ox + x, y: oy + y})), color: col.map(v => v.toString(16).padStart(2, '0')).join('')});
}
const shapes: string[] = [];
cases.forEach((c, i) => {
  const r = fitConnector(c.pts);
  if (!r.ok) throw new Error(`${c.name}: ${r.why}`);
  const x = r.x;
  const av = x.adj.map((v, k) => `<a:gd name="adj${k + 1}" fmla="val ${v}"/>`).join('');
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${i + 2}" name="${c.name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm${x.rot ? ` rot="${x.rot}"` : ''}${x.flipH ? ' flipH="1"' : ''}${x.flipV ? ' flipV="1"' : ''}><a:off x="${x.offX}" y="${x.offY}"/><a:ext cx="${x.extX}" cy="${x.extY}"/></a:xfrm><a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:noFill/><a:ln w="19050"><a:solidFill><a:srgbClr val="${c.color.toUpperCase()}"/></a:solidFill></a:ln></p:spPr></p:sp>`);
});
const rows = Math.ceil(cases.length / COLS);
const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const pptx = path.join(out, 'judge.pptx');
fs.writeFileSync(pptx, packPptx(xml, COLS * CELL * EMU, rows * CELL * EMU));
execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, pptx], {stdio: 'ignore', timeout: 120000});
execFileSync('pdftocairo', ['-svg', path.join(out, 'judge.pdf'), path.join(out, 'judge.svg')]);
const svg = fs.readFileSync(path.join(out, 'judge.svg'), 'utf8');
// cairo writes stroke as rgb(r%,g%,b%); match each case by colour
const drawn = new Map<string, Pt[]>();
for (const m of svg.matchAll(/<path style="[^"]*?stroke:rgb\(([\d.]+)%,([\d.]+)%,([\d.]+)%\)[^"]*" d="([^"]+)"(?: transform="matrix\(([^)]+)\)")?/g)) {
  const hexc = [m[1], m[2], m[3]].map(v => Math.round(parseFloat(v!) * 2.55).toString(16).padStart(2, '0')).join('');
  const nums = m[4]!.match(/-?[\d.]+/g)!.map(Number);
  const [ma, mb, mc, md, me, mf] = m[5] ? m[5].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!, y = nums[i + 1]!;
    pts.push({x: (ma! * x + mc! * y + me!) / 0.75, y: (mb! * x + md! * y + mf!) / 0.75});
  }
  drawn.set(hexc, pts);
}
let ok = 0, bad = 0, missing = 0, worst = 0;
const fails: string[] = [];
for (const c of cases) {
  const near = [...drawn.entries()].find(([k]) => [0, 2, 4].every(i => Math.abs(parseInt(k.slice(i, i + 2), 16) - parseInt(c.color.slice(i, i + 2), 16)) <= 3));
  if (!near) { missing++; fails.push(`${c.name}: not found in the pdf`); continue; }
  // absolute slide coordinates, start to end (the direction the shape was fitted in): no re-basing, no reversing
  const dev = maxDeviation(c.pts, near[1]);
  if (dev !== Infinity) worst = Math.max(worst, dev);
  if (dev <= 1.5) ok++; else { bad++; fails.push(`${c.name}: deviation ${dev === Infinity ? 'shape differs' : dev.toFixed(1) + 'px'} want ${JSON.stringify(simplify(c.pts).map(p => [Math.round(p.x), Math.round(p.y)]))} got ${JSON.stringify(simplify(near[1]).map(p => [Math.round(p.x), Math.round(p.y)]))}`); }
}
console.log({cases: cases.length, ok, bad, missing, worstPx: Number(worst.toFixed(2))});
console.log(fails.slice(0, 12).join('\n'));
