// Color emoji for the resvg drawing (lib/raster.ts). resvg draws a glyph of a color font as its plain outline (Segoe UI Emoji: one flat
// silhouette) or not at all (Noto Color Emoji is bitmaps), so the emoji of a figure would come out in one color or as blanks. Here the
// emoji are drawn by hand: the figure's text keeps its emoji (invisible, so the line keeps its widths), and right after the <text> come the
// pictures of them, read from the same emoji font the layout measures with — through HarfBuzz, which shapes a sequence (a skin tone, a
// flag) to its one glyph: a PNG from the font's CBDT / sbix bitmaps (<image>), or the layers of its COLR table as filled paths. The SVG
// that is written to disk is not touched; this is only on the way to pixels, and costs a font read and a shaping per figure that has emoji.
import * as hb from 'harfbuzzjs';
import { emojiFontFace, textBox } from './font-metrics.js';
import { computeStyles, elements, parseXml } from './svg-dom.js';
import { familyKind, placeRuns } from './svg-geom.js';
import { must } from './must.js';
const r2 = (n) => Math.round(n * 100) / 100;
const hex = (n) => Math.round(n).toString(16).padStart(2, '0');
/**
 * `svg` with the emoji of its <text> elements drawn in color, or `svg` itself when there are none, the emoji font has no color glyphs, or
 * the markup is not what this reads (then the emoji are what resvg makes of them).
 */
export function withColorEmoji(svg, specs) {
    if (!svg.includes('class="emoji"') && !/font-family="[^"]*emoji/i.test(svg))
        return svg; // (the cheap test first: most figures have none)
    const ef = emojiFontFace(specs);
    if (!ef || !(ef.face.hasColorPng() || ef.face.hasColorLayers()))
        return svg;
    let root;
    try {
        root = parseXml(svg);
    }
    catch {
        return svg;
    }
    const styles = computeStyles(root);
    const texts = elements(root).filter(e => e.tag === 'text');
    const spans = [...svg.matchAll(/<text\b[^>]*?(?:\/>|>[\s\S]*?<\/text>)/g)];
    if (!texts.length || spans.length !== texts.length)
        return svg;
    const palette = ef.face.hasColorPalettes() ? ef.face.getColorPalettes()[0]?.colors ?? [] : [];
    let out = '', at = 0, changed = false;
    texts.forEach((text, k) => {
        const m = spans[k];
        if (!m)
            return;
        const runs = placeRuns(text, styles, (t, family, size, weight) => textBox(t, family, size, weight)).filter(r => familyKind(r.style.fontFamily) === 'emoji' && /\P{ASCII}/u.test(r.s));
        const pictures = [];
        const drawn = new Set();
        for (const r of runs) {
            const got = glyphPictures(ef, palette, r.s, r.x, r.y, r.style.fontSize, r.style.fill);
            pictures.push(...got.pictures);
            if (got.all)
                drawn.add(r.s);
        }
        if (!pictures.length)
            return;
        // the emoji that are drawn here are not drawn by the text as well: their span keeps its width and loses its ink
        const hidden = m[0].replace(/<tspan class="emoji">([^<]*)<\/tspan>/g, (all, s) => drawn.has(s) ? `<tspan class="emoji" fill-opacity="0" stroke="none">${s}</tspan>` : all);
        const tf = text.attrs['transform'];
        out += svg.slice(at, m.index) + hidden + (tf ? `<g transform="${tf}">${pictures.join('')}</g>` : pictures.join(''));
        at = m.index + m[0].length;
        changed = true;
    });
    return changed ? out + svg.slice(at) : svg;
}
/** The pictures of the glyphs of `s` drawn from (x, y) at `size`; `all` when every glyph of it got one. */
function glyphPictures(ef, palette, s, x, y, size, fill) {
    const buf = new hb.Buffer();
    buf.addText(s);
    buf.guessSegmentProperties();
    hb.shape(ef.font, buf);
    const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
    const k = size / ef.upem;
    const pictures = [];
    let all = true, pen = x;
    infos.forEach((g, i) => {
        const adv = must(pos[i]).xAdvance * k;
        const picture = glyphPicture(ef, palette, g.codepoint, pen, y, adv, k, fill);
        if (picture)
            pictures.push(picture);
        else if (adv > 0)
            all = false;
        pen += adv;
    });
    return { pictures, all };
}
function glyphPicture(ef, palette, gid, x, y, adv, k, fill) {
    const png = ef.face.hasColorPng() ? ef.font.getGlyphColorPng(gid) : undefined;
    if (png) { // a bitmap font's picture fills the em box from ascent to descent and the advance across (Noto: 136 x 128 px at 109 ppem)
        const top = y - ef.ascender * k, h = (ef.ascender - ef.descender) * k;
        return `<image x="${r2(x)}" y="${r2(top)}" width="${r2(adv)}" height="${r2(h)}" preserveAspectRatio="none" href="data:image/png;base64,${Buffer.from(png).toString('base64')}"/>`;
    }
    const layers = ef.face.hasColorLayers() ? ef.face.getGlyphColorLayers(gid) : [];
    if (!layers.length)
        return null;
    const paths = layers.map(l => {
        const d = ef.font.glyphToPath(l.glyph);
        if (!d)
            return '';
        const c = l.colorIndex === undefined ? null : palette[l.colorIndex];
        const col = c ? `#${hex(c.red)}${hex(c.green)}${hex(c.blue)}` : fill;
        return `<path d="${d}" fill="${col}"${c && c.alpha < 255 && c.alpha > 1 ? ` fill-opacity="${r2(c.alpha / 255)}"` : ''}/>`;
    }).join('');
    return paths ? `<g transform="translate(${r2(x)} ${r2(y)}) scale(${k} ${-k})">${paths}</g>` : null;
}
