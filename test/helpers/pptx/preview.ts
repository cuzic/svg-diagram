#!/usr/bin/env node
// A rough picture of a .pptx slide as PowerPoint lays it out, for looking at the native shapes where no PowerPoint is installed:
// shapes (rect / roundRect / ellipse / custGeom), connectors (from their xfrm and preset, curved ones drawn as their bent twin), text by
// the body's insets and exact line spacing (first baseline at 0.8 of the pitch, the assumption shapes.ts makes), tables as their grid,
// pictures as a hatched box. Not a renderer to trust for small differences: it shares the connector maths with the writer (geom.ts).
//   node test/helpers/pptx/preview.ts out.png file.pptx
import fs from 'node:fs';
import {parseXmlFragment, type El} from '../../../lib/svg-dom.ts';
import {evalConnector, type ConnXfrm} from '../../../lib/pptx/geom.ts';
import {EMU} from '../../../lib/pptx/xml.ts';
import {rasterizeWithResvg} from '../../../lib/raster.ts';
import {unzipEntry} from './unzip.ts';

const kids = (e: El, tag?: string): El[] => e.children.filter((c): c is El => typeof c !== 'string' && (tag === undefined || c.tag === tag));
const kid = (e: El | undefined, tag: string): El | undefined => e && kids(e, tag)[0];
const find = (e: El | undefined, tag: string): El | undefined => { if (!e) return undefined; for (const c of kids(e)) { if (c.tag === tag) return c; const f = find(c, tag); if (f) return f; } return undefined; };
const px = (v: string | undefined): number => Number(v ?? 0) / EMU;
const textOf = (e: El): string => e.children.map(c => typeof c === 'string' ? c : textOf(c)).join('');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const color = (e: El | undefined): string | undefined => { const c = find(e, 'a:srgbClr'); return c ? `#${c.attrs['val']}` : undefined; };

function xf(spPr: El | undefined) {
  const x = kid(spPr, 'a:xfrm'), off = kid(x, 'a:off'), ext = kid(x, 'a:ext');
  return {x: px(off?.attrs['x']), y: px(off?.attrs['y']), w: px(ext?.attrs['cx']), h: px(ext?.attrs['cy']), rot: Number(x?.attrs['rot'] ?? 0), flipH: x?.attrs['flipH'] === '1', flipV: x?.attrs['flipV'] === '1'};
}
function stroke(spPr: El | undefined): string {
  const ln = kid(spPr, 'a:ln');
  if (!ln || kid(ln, 'a:noFill')) return 'stroke="none"';
  const pd = kid(ln, 'a:prstDash')?.attrs['val'];
  const dash = pd === 'sysDot' ? ' stroke-dasharray="2,5"' : pd ? ' stroke-dasharray="6,4"' : '';
  return `stroke="${color(kid(ln, 'a:solidFill')) ?? '#000'}" stroke-width="${px(ln.attrs['w'] ?? '12700')}"${dash}`;
}
const fill = (spPr: El | undefined): string => {
  if (kid(spPr, 'a:noFill')) return 'none';
  const sf = kid(spPr, 'a:solidFill'), alpha = find(sf, 'a:alpha');
  const c = color(sf) ?? 'none';
  return alpha ? `${c}" fill-opacity="${Number(alpha.attrs['val']) / 100000}` : c;
};

function custPath(spPr: El | undefined, r: {x: number; y: number}): string {
  const out: string[] = [];
  const path0 = kid(kid(spPr, 'a:custGeom'), 'a:pathLst');
  let cur = {x: 0, y: 0};
  for (const path of path0 ? kids(path0, 'a:path') : []) {
    for (const s of kids(path)) {
      const pts = kids(s, 'a:pt').map(p => ({x: r.x + px(p.attrs['x']), y: r.y + px(p.attrs['y'])}));
      if (s.tag === 'a:arcTo') {
        // DrawingML: an arc of the ellipse (wR, hR) from the current point, starting at angle stAng and turning swAng (60000ths of a degree)
        const wR = px(s.attrs['wR']), hR = px(s.attrs['hR']), st = Number(s.attrs['stAng']) / 60000 * Math.PI / 180, sw = Number(s.attrs['swAng']) / 60000 * Math.PI / 180;
        const c = {x: cur.x - wR * Math.cos(st), y: cur.y - hR * Math.sin(st)}, end = {x: c.x + wR * Math.cos(st + sw), y: c.y + hR * Math.sin(st + sw)};
        out.push(`A${wR} ${hR} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${end.x},${end.y}`);
        cur = end;
        continue;
      }
      out.push(({'a:moveTo': 'M', 'a:lnTo': 'L', 'a:quadBezTo': 'Q', 'a:cubicBezTo': 'C', 'a:close': 'Z'}[s.tag] ?? '') + pts.map(p => `${p.x},${p.y}`).join(' '));
      const last = pts[pts.length - 1];
      if (last) cur = last;
    }
  }
  return out.join(' ');
}

function text(txBody: El | undefined, r: {x: number; y: number; w: number; h: number}, ins?: {l: number; t: number; r: number}): string {
  if (!txBody) return '';
  const body = kid(txBody, 'a:bodyPr');
  const l = ins?.l ?? px(body?.attrs['lIns'] ?? '91440'), t = ins?.t ?? px(body?.attrs['tIns'] ?? '45720'), rr = ins?.r ?? px(body?.attrs['rIns'] ?? '91440');
  const out: string[] = [];
  let y = r.y + t;
  for (const p of kids(txBody, 'a:p')) {
    const ppr = kid(p, 'a:pPr');
    const pitch = Number(find(kid(ppr, 'a:lnSpc'), 'a:spcPts')?.attrs['val'] ?? 0) / 75;
    y += Number(find(kid(ppr, 'a:spcBef'), 'a:spcPts')?.attrs['val'] ?? 0) / 75;
    const algn = ppr?.attrs['algn'] ?? 'l', marL = px(ppr?.attrs['marL']);
    const lines: El[][] = [[]];
    for (const c of kids(p)) { if (c.tag === 'a:br') lines.push([]); else if (c.tag === 'a:r') lines[lines.length - 1]?.push(c); }
    for (const line of lines) {
      if (!line.length) continue;
      const rpr = kid(line[0] as El, 'a:rPr'), size = Number(rpr?.attrs['sz'] ?? 1800) / 75, step = pitch || size * 1.2;
      const anchor = algn === 'ctr' ? 'middle' : algn === 'r' ? 'end' : 'start';
      const x = algn === 'ctr' ? r.x + (l + marL + r.w - rr) / 2 : algn === 'r' ? r.x + r.w - rr : r.x + l + marL;
      const span = (run: El, t: string) => { const rp = kid(run, 'a:rPr'); return `<tspan fill="${color(kid(rp, 'a:solidFill')) ?? '#000'}"${rp?.attrs['b'] === '1' ? ' font-weight="700"' : ''}>${esc(t)}</tspan>`; };
      const font = 'font-family="BIZ UDPGothic, Noto Sans JP, sans-serif"';
      // a right tab stop: what follows the tab ends at the stop
      const tab = find(kid(ppr, 'a:tabLst'), 'a:tab'), at = line.findIndex(run => textOf(kid(run, 'a:t') as El).startsWith('\t'));
      if (tab?.attrs['algn'] === 'r' && at > 0) {
        out.push(`<text x="${r.x + l}" y="${y + step * 0.8}" font-size="${size}" ${font}>${line.slice(0, at).map(run => span(run, textOf(kid(run, 'a:t') as El))).join('')}</text>`);
        out.push(`<text x="${r.x + l + px(tab.attrs['pos'])}" y="${y + step * 0.8}" font-size="${size}" text-anchor="end" ${font}>${line.slice(at).map(run => span(run, textOf(kid(run, 'a:t') as El).replace('\t', ''))).join('')}</text>`);
      } else out.push(`<text x="${x}" y="${y + step * 0.8}" font-size="${size}" text-anchor="${anchor}" ${font}>${line.map(run => span(run, textOf(kid(run, 'a:t') as El))).join('')}</text>`);
      y += step;
    }
  }
  return out.join('');
}

/** The arrowheads used, one per kind and colour (a head takes its line's colour, as in PowerPoint). */
const markers = new Map<string, string>();
function markerOf(kind: 'a' | 'v' | 'd', color: string): string {
  const id = `${kind}-${color}`, c = `#${color}`;
  const body = kind === 'a' ? `<path d="M0,0 L10,5 L0,10 z" fill="${c}"/>` : kind === 'v' ? `<path d="M0,0 L10,5 L0,10" fill="none" stroke="${c}" stroke-width="1.5"/>` : `<path d="M0,5 L5,0 L10,5 L5,10 z" fill="${c}"/>`;
  markers.set(id, `<marker id="${id}" viewBox="0 0 10 10" refX="${kind === 'd' ? 5 : 9}" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">${body}</marker>`);
  return id;
}
const markerDefs = (): string => [...markers.values()].join('');

/** A DrawingML table: each cell its fill, its own borders (lnL / lnR / lnT / lnB) or the table style's thin white ones, and its text. */
function tableSvg(tbl: El, x0: number, y0: number): string {
  const cols = kids(kid(tbl, 'a:tblGrid') as El, 'a:gridCol').map(c => px(c.attrs['w']));
  const out: string[] = [];
  let y = y0;
  for (const tr of kids(tbl, 'a:tr')) {
    const h = px(tr.attrs['h']);
    let ci = 0;
    for (const tc of kids(tr, 'a:tc')) {
      const span = Number(tc.attrs['gridSpan'] ?? 1);
      if (tc.attrs['hMerge'] === '1' || tc.attrs['vMerge'] === '1') { ci += span; continue; }
      const x = x0 + cols.slice(0, ci).reduce((a, b) => a + b, 0), w = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0);
      const rs = Number(tc.attrs['rowSpan'] ?? 1);
      const rh = rs > 1 ? kids(tbl, 'a:tr').slice(kids(tbl, 'a:tr').indexOf(tr), kids(tbl, 'a:tr').indexOf(tr) + rs).reduce((a, t) => a + px(t.attrs['h']), 0) : h;
      const pr = kid(tc, 'a:tcPr');
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${rh}" fill="${color(kid(pr, 'a:solidFill')) ?? 'none'}" stroke="${pr && kids(pr).some(k => /^a:ln[LRTB]$/.test(k.tag)) ? 'none' : '#ffffff'}" stroke-width="1"/>`);
      for (const [tag, x1, y1, x2, y2] of [['a:lnL', x, y, x, y + rh], ['a:lnR', x + w, y, x + w, y + rh], ['a:lnT', x, y, x + w, y], ['a:lnB', x, y + rh, x + w, y + rh]] as const) {
        const ln = kid(pr, tag);
        if (!ln || kid(ln, 'a:noFill')) continue;
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color(kid(ln, 'a:solidFill')) ?? '#000'}" stroke-width="${px(ln.attrs['w'] ?? '12700')}"/>`);
      }
      out.push(text(kid(tc, 'a:txBody'), {x, y, w, h: rh}, {l: px(pr?.attrs['marL'] ?? '91440'), t: px(pr?.attrs['marT'] ?? '45720'), r: px(pr?.attrs['marR'] ?? '91440')}));
      ci += span;
    }
    y += h;
  }
  return out.join('');
}

function shapes(tree: El): string {
  const out: string[] = [];
  for (const e of kids(tree)) {
    if (e.tag === 'p:grpSp') { out.push(shapes(e)); continue; }
    const spPr = kid(e, 'p:spPr');
    if (e.tag === 'p:sp') {
      const r = xf(spPr), geom = kid(spPr, 'a:prstGeom')?.attrs['prst'];
      if (kid(spPr, 'a:custGeom')) out.push(`<path d="${custPath(spPr, r)}" fill="${fill(spPr)}" ${stroke(spPr)}/>`);
      else if (geom === 'diamond') out.push(`<polygon points="${r.x + r.w / 2},${r.y} ${r.x + r.w},${r.y + r.h / 2} ${r.x + r.w / 2},${r.y + r.h} ${r.x},${r.y + r.h / 2}" fill="${fill(spPr)}" ${stroke(spPr)}/>`);
      else if (geom === 'triangle') out.push(`<polygon points="${r.x + r.w / 2},${r.y} ${r.x + r.w},${r.y + r.h} ${r.x},${r.y + r.h}" fill="${fill(spPr)}" ${stroke(spPr)}/>`);
      else if (geom === 'ellipse') out.push(`<ellipse cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" rx="${r.w / 2}" ry="${r.h / 2}" fill="${fill(spPr)}" ${stroke(spPr)}/>`);
      else {
        const adj = Number(find(kid(spPr, 'a:prstGeom'), 'a:gd')?.attrs['fmla']?.replace('val ', '') ?? 16667) / 100000;
        out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${geom === 'roundRect' ? Math.min(r.w, r.h) * adj : 0}" fill="${fill(spPr)}" ${stroke(spPr)}/>`);
      }
      out.push(text(kid(e, 'p:txBody'), r));
    } else if (e.tag === 'p:cxnSp') {
      const r = xf(spPr), prst = kid(spPr, 'a:prstGeom')?.attrs['prst'];
      const color = find(kid(kid(spPr, 'a:ln'), 'a:solidFill'), 'a:srgbClr')?.attrs['val'] ?? '000000';
      const mark = (tag: string, attr: string) => { const t = kid(kid(spPr, 'a:ln'), tag)?.attrs['type']; return t ? ` ${attr}="url(#${markerOf(t === 'arrow' ? 'v' : t === 'diamond' ? 'd' : 'a', color)})"` : ''; };
      const tail = mark('a:tailEnd', 'marker-end') + mark('a:headEnd', 'marker-start');
      if (kid(spPr, 'a:custGeom')) { out.push(`<path d="${custPath(spPr, r)}" fill="none" ${stroke(spPr)}${tail}/>`); continue; }
      const adj = kids(kid(kid(spPr, 'a:prstGeom'), 'a:avLst') as El, 'a:gd').map(g => Number(g.attrs['fmla']?.replace('val ', '')));
      const c: ConnXfrm = {prst: (prst ?? 'straightConnector1').replace('curvedConnector', 'bentConnector') as ConnXfrm['prst'], offX: r.x * EMU, offY: r.y * EMU, extX: r.w * EMU, extY: r.h * EMU, rot: r.rot ? 5400000 : 0, flipH: r.flipH, flipV: r.flipV, adj};
      out.push(`<polyline points="${evalConnector(c).map(p => `${p.x},${p.y}`).join(' ')}" fill="none" ${stroke(spPr)}${tail}${prst?.startsWith('curved') ? ' stroke-linejoin="round" opacity="0.8"' : ''}/>`);
    } else if (e.tag === 'p:pic') {
      const r = xf(spPr);
      out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#hatch)" stroke="#c00"/>`);
    } else if (e.tag === 'p:graphicFrame') {
      const x = kid(e, 'p:xfrm'), off = kid(x, 'a:off'), ext = kid(x, 'a:ext'), tbl = find(e, 'a:tbl');
      if (!tbl) { out.push(`<rect x="${px(off?.attrs['x'])}" y="${px(off?.attrs['y'])}" width="${px(ext?.attrs['cx'])}" height="${px(ext?.attrs['cy'])}" fill="none" stroke="#888" stroke-dasharray="2,2"/>`); continue; }
      out.push(tableSvg(tbl, px(off?.attrs['x']), px(off?.attrs['y'])));
    }
  }
  return out.join('\n');
}

export function previewSvg(pptx: Buffer): string {
  const pres = parseXmlFragment(unzipEntry(pptx, 'ppt/presentation.xml').toString());
  const size = find(pres, 'p:sldSz');
  const w = px(size?.attrs['cx']), h = px(size?.attrs['cy']);
  const slide = unzipEntry(pptx, 'ppt/slides/slide1.xml').toString();
  const tree = find(parseXmlFragment(slide), 'p:spTree') as El;
  const bg = /<p:bg><p:bgPr><a:solidFill><a:srgbClr val="([0-9A-F]{6})"/.exec(slide)?.[1] ?? 'FFFFFF';
  const drawn = shapes(tree); // first: it registers the arrowheads it uses
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${markerDefs()}<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0,8 L8,0" stroke="#c00" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#${bg}"/>${drawn}</svg>`;
}

if (import.meta.main) {
  const [out, file] = process.argv.slice(2);
  if (!out || !file) { console.error('usage: node test/helpers/pptx/preview.ts out.png file.pptx'); process.exit(2); }
  const svg = previewSvg(fs.readFileSync(file));
  fs.writeFileSync(out, (await rasterizeWithResvg(svg, {png: true})).png as Buffer);
}
