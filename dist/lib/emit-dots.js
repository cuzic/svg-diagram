import { PALETTE, colorOf, toneStyle } from './tokens.js';
import { escapeAttr, emojiSpan } from './emit-common.js';
// dots(): a lane (an axis line), bars on the lane for its zones, a dot per value piled above it, labels under it.
export function renderDots(band, day, tones) {
    const color = (tone) => colorOf(toneStyle(tones, tone).ink, day), n = (v) => +v.toFixed(2);
    const parts = [`<line x1="${n(band.axis.x1)}" y1="${n(band.axis.y)}" x2="${n(band.axis.x2)}" y2="${n(band.axis.y)}" stroke="${PALETTE.muted}" stroke-width="2"/>`];
    for (const z of band.zones)
        parts.push(`<rect x="${n(z.x)}" y="${n(z.top)}" width="${n(z.w)}" height="${n(z.y - 4 - z.top)}" fill="${color(z.tone)}" fill-opacity="0.12"/>`);
    for (const z of band.zones)
        parts.push(`<rect x="${n(z.x)}" y="${n(z.y - 4)}" width="${n(z.w)}" height="8" fill="${color(z.tone)}"/>`);
    const dots = band.dots.map(p => `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${band.r}" fill="${color(p.tone)}"/>`).join('\n    ');
    parts.push(`<g role="img" aria-label="${escapeAttr(band.alt)}">\n    ${dots}\n  </g>`);
    for (const t of band.texts)
        parts.push(`<text x="${n(t.x)}" y="${n(t.y)}" text-anchor="${t.anchor}" font-size="${t.size}" fill="${PALETTE.text}">${emojiSpan(t.text)}</text>`);
    return parts.join('\n  ');
}
