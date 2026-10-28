// wordart(): the look — presets as values, the options resolved on top of them, how far the ink reaches, whether the letters read,
// and the layers a placed wordart is painted in (docs/adr/0009). Pure.
import { must } from './must.js';
import { PALETTE, colorOf, wcagRatio } from './tokens.js';
// ---------------------------------------------------------------------------------------------------------------------------
// the look
// ---------------------------------------------------------------------------------------------------------------------------
const ART_TONES = new Set(['text', 'accent', 'muted', 'danger', 'bg', 'soft']);
export const isArtTone = (v) => ART_TONES.has(v);
export const ART_TONE_NAMES = Object.freeze([...ART_TONES]);
export const WEIGHT_OF = Object.freeze({ normal: 400, bold: 700 });
const OUTLINE_REL = 0.06; // the default outline width, as a share of the size
const SHADOW_REL = 0.06;
const GLOW_REL = 0.25;
const EXTRUDE_REL = 0.1;
const BEVEL_REL = 0.03;
const REFLECTION_GAP_REL = 0.05;
export const REFLECTION_SHARE = 0.6; // how much of the mirror image is kept
export const GLOW_RINGS = 4;
export const EXTRUDE_MAX_STEPS = 12;
/** Presets as values: a look is data, not a code path. */
export const PRESETS = Object.freeze({
    plain: { weight: 400, tone: 'text' },
    bold: { weight: 700, tone: 'text' },
    // a knocked-out letter with a dark rim: reads on any page
    outline: { weight: 700, tone: 'bg', outline: [{ tone: 'text', share: OUTLINE_REL }] },
    shadow: { weight: 700, tone: 'accent', shadow: { tone: 'muted' } },
    // a sticker: a pale halo, then a dark rim, and a shadow under it all
    sticker: { weight: 700, tone: 'accent', outline: [{ tone: 'bg', share: 0.06 }, { tone: 'text', share: 0.05 }], shadow: { tone: 'muted' } },
    // a pale letter with an accent rim, lit from round it
    glow: { weight: 700, tone: 'bg', outline: [{ tone: 'accent', share: 0.04 }], glow: { tone: 'accent' } },
    emboss: { weight: 700, tone: 'soft', outline: [{ tone: 'accent', share: 0.03 }], bevel: true },
    '3d': { weight: 700, tone: 'accent', extrude: { tone: 'text' } },
    gradient: { weight: 700, tone: 'accent', gradient: { from: 'accent', to: 'text' } },
    reflect: { weight: 700, tone: 'accent', reflection: {} },
});
export const asList = (o) => o === undefined || o === false ? undefined : o === true ? [{}] : Array.isArray(o) ? o : [o];
const specOf = (v, preset) => v === false ? undefined : v === undefined ? preset : v === true ? {} : v;
export function sizeOf(size, roles) { return size === undefined ? roles.display : typeof size === 'number' ? size : roles[size]; }
/** The look of a wordart of `size` px: the preset, then each option on top of it. Pure; widths without a px value are shares of the size. */
export function resolveLook(opts, size) {
    const p = PRESETS[opts.style ?? 'bold'];
    // (rounded up to half a pixel: rounding down could take a rim under minRim)
    const px = (share) => Math.max(1.5, Math.ceil(size * share * 2) / 2);
    const outline = opts.outline === false ? [] : opts.outline === undefined ? (p.outline ?? []).map(o => ({ tone: o.tone, width: px(o.share) }))
        : (asList(opts.outline) ?? []).map(o => ({ tone: o.tone ?? 'text', width: o.width ?? px(OUTLINE_REL) }));
    const sh = specOf(opts.shadow, p.shadow), gl = specOf(opts.glow, p.glow), ex = specOf(opts.extrude, p.extrude), rf = specOf(opts.reflection, p.reflection);
    const bevel = opts.bevel === undefined ? p.bevel : opts.bevel;
    const shift = Math.max(2, Math.round(size * SHADOW_REL)), depth = ex?.depth ?? Math.max(3, Math.round(size * EXTRUDE_REL)), grad = opts.gradient ?? (opts.tone === undefined ? p.gradient : undefined);
    const rot = opts.rotate ?? 0, flip = opts.flip, fill = opts.tone ?? p.tone;
    // a depth or a shadow in the colour of the letters melts into them: the default is the other one of text / muted
    const apart = (tone, dflt) => tone === dflt ? (dflt === 'text' ? 'muted' : 'text') : dflt;
    return {
        size,
        weight: opts.weight ? WEIGHT_OF[opts.weight] : p.weight,
        font: opts.font ?? 'sans',
        fill,
        ...(grad ? { gradient: { from: grad.from, to: grad.to, angle: grad.angle ?? 90 } } : {}),
        outlines: outline,
        ...(sh ? { shadow: { tone: sh.tone ?? apart(fill, 'muted'), dx: sh.dx ?? shift, dy: sh.dy ?? shift } } : {}),
        ...(gl ? { glow: { tone: gl.tone ?? 'accent', radius: gl.radius ?? Math.max(3, Math.round(size * GLOW_REL)) } } : {}),
        ...(bevel ? { bevel: { size: Math.max(1, Math.round(size * BEVEL_REL)) } } : {}),
        ...(ex ? { extrude: { tone: ex.tone ?? apart(fill, 'text'), dx: Math.round(depth * 0.7), dy: Math.round(depth * 0.7) } } : {}),
        ...(rf ? { reflection: { opacity: rf.opacity ?? 0.3, gap: rf.gap ?? Math.max(2, Math.round(size * REFLECTION_GAP_REL)) } } : {}),
        ...(opts.plate ? { plate: opts.plate } : {}),
        spacing: opts.spacing ?? 0,
        ...(opts.arc ? { arc: opts.arc } : {}),
        rotate: rot,
        flipH: flip === 'horizontal' || flip === 'both',
        flipV: flip === 'vertical' || flip === 'both',
    };
}
/** How far the ink reaches past the glyph box: the outer outline, the glow, the bevel, and the shift of the shadow and of the depth. */
export function inkReach(look) {
    const o = look.outlines.reduce((s, x) => s + x.width, 0) + (look.glow?.radius ?? 0) + (look.bevel?.size ?? 0);
    // a shadow or a depth pushed up / left (a negative dx / dy) reaches past the top / left edge just as far
    const dx = [look.shadow?.dx ?? 0, look.extrude?.dx ?? 0], dy = [look.shadow?.dy ?? 0, look.extrude?.dy ?? 0];
    return { left: o + Math.max(0, ...dx.map(v => -v)), top: o + Math.max(0, ...dy.map(v => -v)), right: o + Math.max(0, ...dx), bottom: o + Math.max(0, ...dy) };
}
/** An outline thinner than this (px, for letters of `size`) is not a rim: it is a hairline, and does not make a letter read. */
export const minRim = (size) => Math.max(1, size * 0.03);
const rgbOf = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
/** The colours a two-colour gradient passes through (sRGB, the SVG default), end to end. */
export function gradientSteps(from, to, n = 10) {
    const a = rgbOf(from), b = rgbOf(to);
    return Array.from({ length: n + 1 }, (_v, i) => hexOf(a.map((v, k) => v + (must(b[k]) - v) * i / n)));
}
/**
 * Whether the letters read: their fill (every colour a gradient passes through) against what is behind them (the plate, else the page)
 * with 3:1 (large text), or — when the fill is too close to the ground, as a white letter on a white page — the fill against the
 * innermost outline and the outermost outline against the ground, both with 3:1, and both outlines thick enough to be seen (`minRim`).
 * Hollow letters read by their outline alone. `paint` is how the diagram recolours a token hex (its dark appearance): the colours are
 * judged as drawn. Returns the reason it does not, or null.
 */
export function legibilityProblem(look, day, paint = h => h) {
    const c = (t) => paint(colorOf(t, day)), where = look.plate ? 'their plate' : 'the page', ground = c(look.plate ?? 'bg');
    const inner = look.outlines[0], outer = look.outlines[look.outlines.length - 1], thin = look.outlines.find(o => o.width < minRim(look.size));
    const readsAgainst = (hex, other) => wcagRatio(hex, other) >= 3;
    if (look.fill === 'none' && !look.gradient) {
        if (!inner)
            return 'hollow letters (tone: none) need an outline';
        if (inner.width < minRim(look.size))
            return `the outline (${inner.width}px) of hollow letters is a hairline: make it at least ${Math.ceil(minRim(look.size) * 10) / 10}px`;
        return readsAgainst(c(inner.tone), ground) ? null : `the outline (${inner.tone}) of hollow letters barely differs from ${where}`;
    }
    const fills = look.gradient ? gradientSteps(c(look.gradient.from), c(look.gradient.to)) : [c(look.fill)];
    if (fills.every(f => readsAgainst(f, ground)))
        return null;
    const barely = look.gradient ? 'barely differs' : 'barely differ';
    const bad = look.gradient ? `the gradient from ${look.gradient.from} to ${look.gradient.to}` : `the letters (${look.fill})`;
    if (!inner)
        return `${bad} ${barely} from ${where} — pick another tone, add an outline, or put them on a plate`;
    if (thin)
        return `${bad} ${barely} from ${where}, and the outline (${thin.width}px) is a hairline: make it at least ${Math.ceil(minRim(look.size) * 10) / 10}px`;
    if (fills.some(f => !readsAgainst(f, c(inner.tone))))
        return `${bad} ${barely} from its outline (${inner.tone}) — pick other tones`;
    if (outer && !readsAgainst(c(outer.tone), ground))
        return `the outline (${outer.tone}) barely differs from ${where} — add an outer outline of a darker tone`;
    return null;
}
/** The gradient a fill refers to, in the figure's own coordinates (the same for every run, so a vertical text's columns share one). */
/**
 * The id of a wordart's gradient: the figure's own id and the two colours it is drawn with. The colours are what a theme changes, and a
 * page with two SVGs of one figure in two themes would otherwise have two defs of one name.
 */
export function gradientId(art, day) {
    const g = art.look.gradient, ends = g ? colorOf(g.from, day) + colorOf(g.to, day) : '';
    let h = 5381;
    for (const ch of ends)
        h = (Math.imul(h, 33) ^ ch.charCodeAt(0)) >>> 0;
    return `${art.uid}-g${h.toString(36)}`;
}
export function gradientOf(art, day) {
    const g = art.look.gradient;
    if (!g)
        return undefined;
    const a = g.angle * Math.PI / 180, { x, y, w, h } = art.local, cx = x + w / 2, cy = y + h / 2, L = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
    return { id: gradientId(art, day), x1: cx - L * Math.cos(a), y1: cy - L * Math.sin(a), x2: cx + L * Math.cos(a), y2: cy + L * Math.sin(a), from: colorOf(g.from, day), to: colorOf(g.to, day) };
}
/** The layers of a placed wordart for a theme, bottom to top: mirror image, shadow, glow, depth, outer outlines, bevel, the text. Pure. */
export function paintLayers(art, day, dim = false) {
    const { look } = art, col = (t) => colorOf(t, day), layers = [];
    // spotlight dims everything but the shape of the letters: one muted layer (a hollow letter keeps its rim), no decoration, no gradient
    if (dim)
        return [{ fill: look.fill === 'none' && !look.gradient ? 'none' : PALETTE.muted, ...(look.fill === 'none' && !look.gradient && look.outlines[0] ? { stroke: PALETTE.muted, sw: look.outlines[0].width } : {}), dx: 0, dy: 0, hidden: false, text: true }];
    const total = look.outlines.reduce((s, o) => s + o.width, 0), inner = look.outlines[0];
    const fill = look.gradient ? `url(#${gradientId(art, day)})` : look.fill === 'none' ? 'none' : col(look.fill);
    const hollow = fill === 'none';
    const silhouette = (tone, width, extra = {}) => ({ fill: col(tone), ...(width > 0 ? { stroke: col(tone), sw: 2 * width } : {}), dx: 0, dy: 0, hidden: true, ...extra });
    const own = inner ? { stroke: col(inner.tone), sw: hollow ? inner.width : 2 * inner.width } : {};
    if (look.reflection)
        layers.push({ fill, ...own, dx: 0, dy: 0, opacity: look.reflection.opacity, hidden: true, mirror: true });
    if (look.shadow)
        layers.push(silhouette(look.shadow.tone, total, { dx: look.shadow.dx, dy: look.shadow.dy }));
    if (look.glow)
        for (let k = GLOW_RINGS; k >= 1; k--)
            layers.push(silhouette(look.glow.tone, total + look.glow.radius * k / GLOW_RINGS, { opacity: 0.12 }));
    if (look.extrude) {
        const n = Math.min(EXTRUDE_MAX_STEPS, Math.max(1, Math.ceil(Math.max(look.extrude.dx, look.extrude.dy))));
        for (let i = n; i >= 1; i--)
            layers.push(silhouette(look.extrude.tone, total, { dx: look.extrude.dx * i / n, dy: look.extrude.dy * i / n }));
    }
    let reach = total;
    for (const o of [...look.outlines].reverse().slice(0, -1)) {
        layers.push(silhouette(o.tone, reach));
        reach -= o.width;
    }
    if (look.bevel) {
        const b = look.bevel.size;
        layers.push(silhouette('text', total, { dx: b, dy: b, opacity: 0.45 }), silhouette('bg', total, { dx: -b, dy: -b, opacity: 0.8 }));
    }
    layers.push({ fill, ...own, dx: 0, dy: 0, hidden: false, text: true });
    return layers;
}
/** The transform of a turned / mirrored figure about the band's centre, or null. Mirroring comes first. */
export function figureTransform(art) {
    const { look } = art, cx = art.x + art.w / 2, cy = art.y + art.h / 2, n = (v) => Math.round(v * 100) / 100;
    const flip = look.flipH || look.flipV ? ` translate(${n(cx)} ${n(cy)}) scale(${look.flipH ? -1 : 1} ${look.flipV ? -1 : 1}) translate(${n(-cx)} ${n(-cy)})` : '';
    const turn = look.rotate ? `rotate(${n(look.rotate)} ${n(cx)} ${n(cy)})` : '';
    return `${turn}${flip}`.trim() || null;
}
