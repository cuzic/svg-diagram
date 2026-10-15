// Outside judge for the connection-site numbering (rect: 0 top, 1 left, 2 bottom, 3 right). LibreOffice re-routes a glued connector,
// so where the stroke ends in the pdf shows which side of the box idx meant. ODF's own glue numbering is top, RIGHT, bottom, LEFT, so
// a swapped 1/3 would show here.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {packSlide} from '../../../lib/pptx/emit.ts';
import type {Pt} from '../../../lib/pptx/geom.ts';
import {EMU} from '../../../lib/pptx/xml.ts';

const out = process.argv[2]!;
fs.mkdirSync(out, {recursive: true});
const W = 120, H = 60, CELL = 500;
// the straight xfrm is moved 150px away from where the glue points: a pass means LibreOffice followed stCxn / endCxn, not the xfrm
const SHIFT = Number(process.env.SHIFT ?? 150);
const E = (v: number): number => Math.round(v * EMU);
const site = (x: number, y: number, idx: number): Pt => [{x: x + W / 2, y}, {x, y: y + H / 2}, {x: x + W / 2, y: y + H}, {x: x + W, y: y + H / 2}][idx]!;
interface Case {name: string; from: Pt; to: Pt; color: string}
const cases: Case[] = [], shapes: string[] = [];
let id = 2;
const box = (x: number, y: number, name: string): number => {
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${E(x)}" y="${E(y)}"/><a:ext cx="${E(W)}" cy="${E(H)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="EEEEEE"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="888888"/></a:solidFill></a:ln></p:spPr></p:sp>`);
  return id++;
};
let n = 0;
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
  const cx = (n % 4) * CELL, cy = Math.floor(n / 4) * CELL;
  const ax = cx + 20, ay = cy + 20, bx = cx + 300, by = cy + 260;
  const A = box(ax, ay, `A${a}${b}`), B = box(bx, by, `B${a}${b}`);
  const col = [20 + n * 14, 200 - n * 9, 60];
  const color = col.map(v => v.toString(16).padStart(2, '0')).join('');
  const p = site(ax, ay, a), q = site(bx, by, b);
  cases.push({name: `A.idx${a} -> B.idx${b}`, from: p, to: q, color});
  // the xfrm is a plain straight line between the two points; the glue says where it really attaches
  shapes.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id++}" name="c${a}${b}"/><p:cNvCxnSpPr><a:stCxn id="${A}" idx="${a}"/><a:endCxn id="${B}" idx="${b}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${E(Math.min(p.x, q.x) + SHIFT)}" y="${E(Math.min(p.y, q.y) + SHIFT)}"/><a:ext cx="${E(Math.abs(q.x - p.x))}" cy="${E(Math.abs(q.y - p.y))}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="19050"><a:solidFill><a:srgbClr val="${color.toUpperCase()}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`);
  n++;
}
const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const pptx = path.join(out, 'glue.pptx');
fs.writeFileSync(pptx, packSlide({xml, cx: 4 * CELL * EMU, cy: 4 * CELL * EMU, pictures: []}));
execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, pptx], {stdio: 'ignore', timeout: 120000});
execFileSync('pdftocairo', ['-svg', path.join(out, 'glue.pdf'), path.join(out, 'glue.svg')]);
const svg = fs.readFileSync(path.join(out, 'glue.svg'), 'utf8');
const drawn = new Map<string, Pt[]>();
for (const m of svg.matchAll(/<path style="[^"]*?stroke:rgb\(([\d.]+)%,([\d.]+)%,([\d.]+)%\)[^"]*" d="([^"]+)"(?: transform="matrix\(([^)]+)\)")?/g)) {
  const hexc = [m[1], m[2], m[3]].map(v => Math.round(parseFloat(v!) * 2.55).toString(16).padStart(2, '0')).join('');
  const nums = m[4]!.match(/-?[\d.]+/g)!.map(Number);
  const [ma, mb, mc, md, me, mf] = m[5] ? m[5].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({x: (ma! * nums[i]! + mc! * nums[i + 1]! + me!) / 0.75, y: (mb! * nums[i]! + md! * nums[i + 1]! + mf!) / 0.75});
  drawn.set(hexc, pts);
}
let ok = 0;
const bad: string[] = [];
for (const c of cases) {
  const got = [...drawn.entries()].find(([k]) => [0, 2, 4].every(i => Math.abs(parseInt(k.slice(i, i + 2), 16) - parseInt(c.color.slice(i, i + 2), 16)) <= 3))?.[1];
  if (!got) { bad.push(`${c.name}: not drawn`); continue; }
  const a = got[0]!, z = got[got.length - 1]!;
  const d = Math.max(Math.hypot(a.x - c.from.x, a.y - c.from.y), Math.hypot(z.x - c.to.x, z.y - c.to.y));
  if (d <= 2) ok++; else bad.push(`${c.name}: start (${Math.round(a.x)},${Math.round(a.y)}) want (${Math.round(c.from.x)},${Math.round(c.from.y)}); end (${Math.round(z.x)},${Math.round(z.y)}) want (${Math.round(c.to.x)},${Math.round(c.to.y)})`);
}
console.log({cases: cases.length, ok, bad: bad.length});
console.log(bad.slice(0, 8).join('\n'));
if (bad.length) process.exitCode = 1;
