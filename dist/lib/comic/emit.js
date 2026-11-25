// The drawing of a comic() band (ADR 0074 D1 / D2 / D4): the panels, the characters, the bubbles and their tails, the blanks in
// their three states. Text widths come from the layout or the supplied value measurements.
import { escapeAttr, escapeXml } from '../emit-common.js';
import { qualify, scopeOf } from '../scope-name.js';
import { balloonPath } from './balloon-path.js';
import { BADGE, BADGE_OVERHANG, COLOR, FONT, FRAME, SLOT_FONT, TAIL_HALF, f1 } from './constants.js';
import { characterSvg } from './character.js';
import { faceSvg } from './face.js';
import { slotFontSize, slotValue } from './slot-values.js';
import { fillTemplate, parseTemplate } from './template.js';
const tintOf = (p) => p.tint === 'warm' ? COLOR.warm : p.tint === 'cool' ? COLOR.cool : COLOR.paper;
function personSvg(h, p, characters, namespace, clipId) {
    // Dots are reserved in comic ids. Escaping hyphens keeps the two components distinct when joined.
    const prefix = `ch-${namespace}${p.id.replaceAll('-', '.')}-${h.who.replaceAll('-', '.')}`;
    const look = h.look;
    if (look.kind === 'asset') {
        const ch = characters[look.asset];
        const svg = ch && characterSvg(ch, h.expression, h, `${prefix}-`);
        if (svg)
            return `<g data-head="${h.id}" clip-path="url(#${clipId})">${svg}</g>`;
    }
    const face = look.kind === 'face' ? look : { hue: 210, hair: 'short' };
    return `<g data-head="${h.id}">${faceSvg(h, face.hue, face.hair, p.y + p.h, prefix)}</g>`;
}
function panelSvg(p, characters, namespace, node) {
    const clipId = `pc-${namespace}${p.id}`;
    const out = [`<g data-panel="${p.id}"><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${tintOf(p)}" stroke="${COLOR.ink}" stroke-width="${FRAME}"${node}/>`];
    if (p.label !== undefined) {
        const x = p.x - BADGE_OVERHANG, y = p.y - BADGE_OVERHANG;
        out.push(`<rect x="${x}" y="${y}" width="${BADGE}" height="${BADGE}" fill="${COLOR.ink}"/><text x="${x + BADGE / 2}" y="${y + 17}" text-anchor="middle" font-size="${SLOT_FONT}" font-weight="700" fill="${COLOR.paper}">${escapeXml(p.label)}</text>`);
    }
    for (const h of p.heads)
        out.push(personSvg(h, p, characters, namespace, clipId));
    out.push('</g>');
    return out.join('');
}
function slotSvg(s, blank, node, value, widthOf) {
    const group = `<g data-slot="${s.id}"${node}>`;
    const cx = f1(s.x + s.w / 2);
    if (value) {
        const clip = `slot-clip-${s.id}`;
        const size = slotFontSize(s, value, widthOf);
        const filled = value.weight === 700;
        return group + `<clipPath id="${clip}"><rect x="${s.x}" y="${f1(s.y - 4)}" width="${s.w}" height="${s.h + 8}"/></clipPath>`
            + `<text x="${cx}" y="${f1(s.y + s.h / 2)}" text-anchor="middle" dominant-baseline="central" xml:space="preserve" font-size="${size}"${filled ? ' font-weight="700"' : ''} fill="${filled ? COLOR.filled : COLOR.prompt}" clip-path="url(#${clip})">${escapeXml(value.text)}</text></g>`;
    }
    const line = `<line x1="${s.x}" y1="${f1(s.y + s.h)}" x2="${f1(s.x + s.w)}" y2="${f1(s.y + s.h)}" stroke="${COLOR.prompt}" stroke-width="2" stroke-dasharray="2 3"/>`;
    const prompt = blank === 'line' ? '' : `<text x="${cx}" y="${f1(s.y + s.h - 5)}" text-anchor="middle" font-size="${SLOT_FONT}" fill="${COLOR.prompt}">${escapeXml(s.prompt)}</text>`;
    return group + line + prompt + '</g>';
}
/** The body and the tail are one closed path (lib/comic/balloon-path.ts). */
function outlineSvg(b, node) {
    const { d } = balloonPath(b, b.kind, b.tail ? { tip: b.tail.tip, halfWidth: TAIL_HALF } : undefined);
    const style = b.kind === 'think' ? ' stroke-dasharray="6 3"' : '';
    return `<path d="${d}" fill="${COLOR.bubble}" stroke="${COLOR.ink}" stroke-width="${b.kind === 'shout' ? 3.5 : b.kind === 'narration' ? 2 : 2.5}" stroke-linejoin="round"${style}${node}/>`;
}
function bubbleSvg(b, blank, node, values, widthOf) {
    const texts = new Map();
    const slots = b.slots.map(s => {
        const value = slotValue(s, values);
        if (value)
            texts.set(s.id, value.text);
        return slotSvg(s, blank, node(s.id), value, widthOf);
    }).join('');
    const title = b.template && texts.size ? fillTemplate(parseTemplate(b.template), id => texts.get(id) ?? '＿＿') : b.title;
    return `<g data-bubble="${b.id}"><title>${escapeXml(title)}</title>${outlineSvg(b, node(b.id))}`
        + b.runs.map(r => `<text x="${r.x}" y="${r.y}" font-size="${FONT}" fill="${COLOR.ink}">${escapeXml(r.text)}</text>`).join('') + slots + '</g>';
}
export function renderComicBand(b, values = {}, widthOf) {
    const scope = scopeOf(b);
    // A leading hyphen reserves the scoped namespace. Scope names can contain characters that are unsafe in url(#id).
    const namespace = scope ? `-${scope.split('').map(c => c.charCodeAt(0).toString(16)).join('_')}-` : '';
    const node = (id) => b.nodeIds ? ` data-node="${escapeAttr(qualify(scope, id))}"` : '';
    return `<g data-comic="${b.layout}"><title>${escapeXml(b.title)}</title>${b.panels.map(p => panelSvg(p, b.characters, namespace, node(p.id))).join('')}${b.bubbles.map(x => bubbleSvg(x, b.blank, node, values, widthOf)).join('')}</g>`;
}
