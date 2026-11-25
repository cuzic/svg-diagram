import { pillSvg } from './badge.js';
import { arrowMarkers, escapeXml, lineAttrs, resolveLineColor, snap4, tonedHead, trimPoints } from './emit-common.js';
import { CONNECT_LABEL_SIZE, PALETTE, STRONG_STROKE } from './tokens.js';
export function connectorSvgDefs(connects, day, tones) {
    const arrows = connects.filter(connector => connector.arrow !== 'none');
    const tonedHeads = ['accent', 'muted', 'danger'].filter(tone => arrows.some(connector => tonedHead(connector) === tone));
    return {
        arrow: arrows.length > 0,
        dimArrow: arrows.some(connector => connector.dim),
        strongArrow: arrows.some(connector => connector.weight === 'strong'),
        dimStrongArrow: arrows.some(connector => connector.dim && connector.weight === 'strong'),
        markers: tonedHeads.map(t => `
    <marker id="dsl-arrow-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${resolveLineColor(tones, t, day)}"/>
    </marker>`).join(''),
    };
}
function renderConnectPath(c) {
    const points = c.weight === 'strong' ? trimPoints(c.points, c.arrow) : c.points;
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
}
export function renderConnect(c, day, tones, roles) {
    const color = c.dim ? PALETTE.muted : resolveLineColor(tones, c.tone, day);
    const d = renderConnectPath(c);
    const strong = c.weight === 'strong';
    const markers = arrowMarkers(c.arrow, c.dim, strong, tonedHead(c));
    let path;
    if (strong) {
        path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${STRONG_STROKE}"${lineAttrs(c.line)}${markers}/>`;
    }
    else if (c.line === 'double') {
        // a thick line with a background-colored core: reads as "=" and keeps the arrowhead on the core
        path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="6"/>\n  <path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${markers}/>`;
    }
    else {
        path = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"${lineAttrs(c.line)}${markers}/>`;
    }
    if (!c.label)
        return path;
    // labelX/labelY (and chipBox) are computed once in layout.ts's resolveConnect()
    // along with labelBox, which verify.ts checks for overlap — reusing them here
    // keeps emit and verify looking at the same point.
    if (c.chipBox) {
        const b = c.chipBox;
        return `${path}\n  ${pillSvg({ x: snap4(b.x), y: snap4(b.y), w: snap4(b.w), h: b.h, fill: PALETTE.bg, stroke: color, cx: c.labelX, baseline: c.labelY, rawY: b.y, text: color, size: (roles.connectLabel ?? CONNECT_LABEL_SIZE), weight: 400, labelHtml: escapeXml(c.label) })}`;
    }
    return `${path}\n  <text x="${c.labelX}" y="${c.labelY}" text-anchor="middle" font-size="${(roles.connectLabel ?? CONNECT_LABEL_SIZE)}" fill="${color}">${escapeXml(c.label)}</text>`;
}
export const connectSpotlight = { endpoints: data => [data.from, data.to] };
