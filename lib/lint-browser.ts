// The checks on the rendering, done in a real browser: the original implementation, kept as `lint --engine browser` and as the
// oracle the geometry engine (lib/svg-lint.ts) is tested against. Takes an SVG's text and a page of a launched Chromium.
import type {Page} from 'playwright-chromium';
import type {RenderChecks} from './svg-lint.ts';

export async function browserChecks(page: Page, src: string): Promise<RenderChecks | null> {
  await page.setContent(`<body style="margin:0">${src}</body>`);
  return page.evaluate(() => {
    const svg = document.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return null;
    const vb = svg.viewBox.baseVal;
    const W = vb.width || +svg.getAttribute('width')!;
    const H = vb.height || +svg.getAttribute('height')!;

    type RGBA = {r: number; g: number; b: number; a: number};
    const parseColor = (c: string): RGBA | null => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
      return m ? {r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4]} : null;
    };
    const luminance = (c: RGBA) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const compositeOver = (fg: RGBA, bg: RGBA): RGBA => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });

    const shapes = ([...svg.querySelectorAll('rect,circle,ellipse,polygon,path')] as SVGGraphicsElement[]).map(e => {
      let bb: DOMRect;
      try { bb = e.getBBox(); } catch { return null; }
      const cs = getComputedStyle(e);
      const c = parseColor(cs.fill);
      if (!c || cs.fill === 'none') return null;
      const a = c.a * parseFloat(cs.fillOpacity || '1') * parseFloat(cs.opacity || '1');
      return {bb, c: {...c, a}};
    }).filter((x): x is {bb: DOMRect; c: RGBA} => x !== null);

    const am = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(svg.getAttribute('data-assumed-bg') ?? '');
    const page = am ? {r: parseInt(am[1], 16), g: parseInt(am[2], 16), b: parseInt(am[3], 16), a: 1} : {r: 255, g: 255, b: 255, a: 1};
    const contrast: {txt: string; delta: number; fg: string; bg: string}[] = [];
    for (const t of svg.querySelectorAll('text')) {
      if (t.closest('[aria-hidden="true"]')) continue; // decoration (a wordart's shadow / outer outlines), not a label
      let bb: DOMRect;
      try { bb = t.getBBox(); } catch { continue; }
      if (!bb.width) continue;
      const txt = (t.textContent || '').trim();
      if (!txt) continue;
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      // text on an <image> needs an opaque shape between them (its pixels are unknown): same rule as svg-lint.ts
      const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const pics = ([...svg.querySelectorAll('image')] as SVGGraphicsElement[]).filter(im => {
        const q = im.getBBox();
        return before(im, t) && cx >= q.x && cx <= q.x + q.width && cy >= q.y && cy <= q.y + q.height;
      });
      const pic = pics[pics.length - 1];
      if (pic) {
        const plated = ([...svg.querySelectorAll('rect,circle,ellipse,polygon,path')] as SVGGraphicsElement[]).some(e => {
          if (!before(pic, e) || !before(e, t)) return false;
          const cs = getComputedStyle(e), c = parseColor(cs.fill), q = e.getBBox();
          return !!c && cs.fill !== 'none' && c.a * parseFloat(cs.fillOpacity || '1') * parseFloat(cs.opacity || '1') >= 0.9
            && bb.x >= q.x - 1 && bb.x + bb.width <= q.x + q.width + 1 && bb.y >= q.y - 1 && bb.y + bb.height <= q.y + q.height + 1;
        });
        if (!plated) { contrast.push({txt: txt.slice(0, 40), delta: 0, fg: getComputedStyle(t).fill, bg: 'image (no opaque plate behind the text)'}); continue; }
      }
      let bg = {...page};
      for (const s of shapes) {
        const q = s.bb;
        if (cx >= q.x && cx <= q.x + q.width && cy >= q.y && cy <= q.y + q.height) bg = compositeOver(s.c, bg);
      }
      // a tspan with a colour of its own is judged on its own (text nodes grouped by the colour they are drawn in)
      const groups = new Map<string, string>();
      const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const fill = getComputedStyle(n.parentElement as Element).fill;
        groups.set(fill, (groups.get(fill) ?? '') + (n.textContent ?? ''));
      }
      const parts = [...groups].filter(([, g]) => g.trim());
      for (const [fill, g] of parts) {
        const tc = parseColor(fill);
        if (!tc) continue;
        const d = Math.abs(luminance(tc) - luminance(bg));
        const rim = parseColor(getComputedStyle(t).stroke), rimReads = rim && parseFloat(getComputedStyle(t).strokeWidth) > 0 && Math.abs(luminance(rim) - luminance(bg)) >= 70; // an outlined letter reads by its rim
        if (d < 70 && !rimReads) {
          contrast.push({txt: (parts.length > 1 ? g.trim() : txt).slice(0, 40), delta: +d.toFixed(0), fg: fill, bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})`});
        }
      }
    }

    let bbAll: DOMRect | null;
    try { bbAll = svg.getBBox(); } catch { bbAll = null; }
    const overflow = bbAll && (bbAll.y + bbAll.height > H + 2 || bbAll.x + bbAll.width > W + 2)
      ? {dx: +(bbAll.x + bbAll.width - W).toFixed(0), dy: +(bbAll.y + bbAll.height - H).toFixed(0)}
      : null;

    const texts = [...svg.querySelectorAll('text')].map(t => {
      if (t.closest('[aria-hidden="true"]')) return null;
      const bb = t.getBoundingClientRect();
      const txt = (t.textContent || '').trim();
      if (!txt || !bb.width || !bb.height) return null;
      return {txt: txt.slice(0, 30), bb};
    }).filter((x): x is {txt: string; bb: DOMRect} => x !== null);

    const textOverlap: {a: string; b: string; ratio: number}[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].bb, b = texts[j].bb;
        const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ix <= 0 || iy <= 0) continue;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        const ratio = (ix * iy) / minArea;
        if (ratio > 0.3) {
          textOverlap.push({a: texts[i].txt, b: texts[j].txt, ratio: +ratio.toFixed(2)});
        }
      }
    }

    const rects = [...svg.querySelectorAll('rect,g[data-badge]')].map(r => {
      const cs = getComputedStyle(r);
      if (r.tagName !== 'g' && cs.fill === 'none' && cs.stroke === 'none') return null; // a badge group is the container of its own label
      const bb = r.getBoundingClientRect();
      if (!bb.width || !bb.height) return null;
      return bb;
    }).filter((x): x is DOMRect => x !== null);

    const containerOverflow: {txt: string; over: number}[] = [];
    const PAD = 4;
    for (const t of texts) {
      const bb = t.bb;
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      let best: DOMRect | null = null;
      for (const r of rects) {
        if (cx < r.x || cx > r.x + r.width || cy < r.y || cy > r.y + r.height) continue;
        const area = r.width * r.height;
        if (area < bb.width * bb.height) continue;
        if (!best || area < best.width * best.height) best = r;
      }
      if (!best) continue;
      const over = Math.max(
        best.x + PAD - bb.x,
        (bb.x + bb.width) - (best.x + best.width - PAD),
        best.y + PAD - bb.y,
        (bb.y + bb.height) - (best.y + best.height - PAD),
      );
      if (over > 3) containerOverflow.push({txt: t.txt, over: +over.toFixed(1)});
    }

    // A shape painted AFTER a text (so on top of it) must not cover the text, and a line must not run through it.
    // (A background drawn before the text is fine, and so is a shape marked data-allow-cover on itself or an ancestor.)
    const covered: {txt: string; by: string; how: 'covers' | 'crosses'}[] = [];
    {
      const items = ([...svg.querySelectorAll('rect,circle,ellipse,path,line,polygon,polyline,text')] as SVGGeometryElement[]).filter(e => !e.closest('defs,marker'));
      const info = items.map(e => {
        const cs = getComputedStyle(e);
        return {e, tag: e.tagName.toLowerCase(), bb: e.getBoundingClientRect(),
          fill: cs.fill !== 'none', stroke: cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0,
          op: parseFloat(cs.opacity) * parseFloat(cs.fillOpacity || '1')};
      });
      info.forEach((t, i) => {
        if (t.tag !== 'text' || !t.bb.width || !t.e.textContent!.trim()) return;
        for (let j = i + 1; j < info.length; j++) {
          const sh = info[j];
          if (sh.tag === 'text' || !sh.bb.width && !sh.bb.height || sh.e.closest('[data-allow-cover]')) continue;
          const ow = Math.min(t.bb.right, sh.bb.right) - Math.max(t.bb.left, sh.bb.left);
          const oh = Math.min(t.bb.bottom, sh.bb.bottom) - Math.max(t.bb.top, sh.bb.top);
          if (ow < 0 || oh < 0) continue; // (a vertical or horizontal line has a zero-width box: it can still run through the text)
          if (sh.fill && sh.op >= 0.5 && ow >= 3 && oh >= 3 && ow * oh >= 30) { covered.push({txt: t.e.textContent.trim(), by: sh.tag, how: 'covers'}); break; }
          if (sh.stroke && !sh.fill && sh.tag !== 'rect' && sh.e.getTotalLength) { // a stroke-only line/path: does it run through the text box?
            const len = sh.e.getTotalLength(), m = sh.e.getScreenCTM()!;
            let hit = false;
            for (let l = 0; l <= len && !hit; l += 3) {
              const pt = sh.e.getPointAtLength(l);
              const x = pt.x * m.a + pt.y * m.c + m.e, y = pt.x * m.b + pt.y * m.d + m.f;
              hit = x >= t.bb.left && x <= t.bb.right && y >= t.bb.top + 2 && y <= t.bb.bottom - 2;
            }
            if (hit) { covered.push({txt: t.e.textContent.trim(), by: sh.tag, how: 'crosses'}); break; }
          }
        }
      });
    }

    return {contrast, overflow, textOverlap, containerOverflow, covered};
  });
}
