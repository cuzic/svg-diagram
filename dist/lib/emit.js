// Serializes a layoutDiagram() result (see layout.ts) into an SVG string. The per-type renderers live in emit-*.ts;
// emit-handlers.ts is the table that picks one per band type.
import { PALETTE, FONT_STACKS, STRONG_HEAD, STRONG_HEAD_REF_X, recolor, MIN_FONT_SIZE, customColors, mapOf, toneEnv, toneColors } from './tokens.js';
import { diagramTitle, diagramDesc } from './rules.js';
import { visibleAt } from './reveal.js';
import { spotlightDim } from './spotlight.js';
import { escapeXml } from './emit-common.js';
import { renderConnect } from './emit-boxes.js';
import { renderBand } from './emit-handlers.js';
import { withNodeIds } from './emit-node-ids.js';
import { autoBlock } from './appearance-auto.js';
export { resolveTextColor, resolveBoxStyle } from './emit-common.js';
export { renderFlowShape } from './emit-figures.js';
function usesArrows(laidOutDiagram) {
    if (laidOutDiagram.connects.some(c => c.arrow !== 'none'))
        return true;
    if (laidOutDiagram.laidOut.some(b => b.type === 'legend' && b.items.some(i => i.line && (i.arrow ?? 'end') !== 'none')))
        return true;
    if (laidOutDiagram.laidOut.some(b => b.type === 'sequence' && b.steps.some(x => (x.kind === 'msg' && x.arrow !== 'none') || x.kind === 'self')))
        return true;
    if (laidOutDiagram.laidOut.some(b => b.type === 'cycle'))
        return true;
    return laidOutDiagram.laidOut.some(b => b.type === 'row' && b.arrows.length > 0);
}
// A band's own text runs, or (row/grid) its child boxes — which carry runs of their own.
function bandRuns(b) {
    if ('wrappedRuns' in b)
        return b.wrappedRuns;
    if ('children' in b)
        return b.children;
    return [];
}
export function emitSvg(laidOutDiagram, opts = {}) {
    return emitSvgWith(opts.nodeIds ? withNodeIds(laidOutDiagram) : laidOutDiagram, toneEnv(laidOutDiagram.tones), opts);
}
function emitSvgWith(laidOutDiagram, tones, opts) {
    const { width, canvasHeight, day, laidOut, connects, roles } = laidOutDiagram;
    const usesMono = laidOut.some(b => bandRuns(b).some(x => x.mono || (('wrappedRuns' in x ? x.wrappedRuns : undefined) ?? []).some(r => r.mono)))
        || laidOut.some(b => b.type === 'table' && b.rows.some(r => r.cells.some(c => c.mono && c.lines.length)));
    const needsArrow = usesArrows(laidOutDiagram);
    const needsDimArrow = connects.some(c => c.dim && c.arrow !== 'none') || laidOut.some(b => b.dim && (b.type === 'row' && b.arrows.length > 0
        || b.type === 'legend' && b.items.some(i => i.line && (i.arrow ?? 'end') !== 'none')
        || b.type === 'sequence' && b.steps.some(x => x.kind === 'self' || x.kind === 'msg' && x.arrow !== 'none')
        || b.type === 'cycle'));
    // strong arrows have markers of their own (a fixed size, so a thick line does not scale its head)
    const strongArrow = (c) => c.weight === 'strong' && c.arrow !== 'none';
    const strongItem = (i) => i.weight === 'strong' && (i.arrow ?? 'end') !== 'none';
    const needsStrongArrow = connects.some(strongArrow) || laidOut.some(b => b.type === 'legend' && b.items.some(strongItem));
    const needsDimStrongArrow = connects.some(c => c.dim && strongArrow(c)) || laidOut.some(b => b.dim && b.type === 'legend' && b.items.some(strongItem));
    const strongMarker = (id, fill) => `
    <marker id="${id}" viewBox="0 0 10 10" refX="${STRONG_HEAD_REF_X}" refY="5" markerUnits="userSpaceOnUse" markerWidth="${STRONG_HEAD}" markerHeight="${STRONG_HEAD}" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${fill}"/>
    </marker>`;
    const defs = needsArrow ? `
  <defs>
    <marker id="dsl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${PALETTE.text}"/>
    </marker>${needsDimArrow ? `
    <marker id="dsl-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${PALETTE.muted}"/>
    </marker>` : ''}${needsStrongArrow ? strongMarker('dsl-arrow-strong', PALETTE.text) : ''}${needsDimStrongArrow ? strongMarker('dsl-arrow-strong-dim', PALETTE.muted) : ''}
  </defs>` : '';
    const style = `
    text { font-family: ${FONT_STACKS.sans}; }${usesMono ? `
    .mono { font-family: ${FONT_STACKS.mono}; }` : ''}
    .emoji { font-family: ${FONT_STACKS.emoji}; }`;
    const dimFill = spotlightDim(laidOutDiagram) === 'fill';
    const body = laidOut.filter(band => visibleAt(band, opts.reveal)).map(band => renderBand(band, day, tones, roles, opts.reveal, dimFill)).join('\n\n  ');
    const connectSvg = connects.filter(c => visibleAt(c, opts.reveal)).map(c => renderConnect(c, day, tones, roles)).join('\n\n  ');
    // doc-medium diagrams carry an accessible name/description and (when built from a file) provenance
    let a11y = '', head = '';
    if (laidOutDiagram.medium === 'doc') {
        const title = diagramTitle(laidOutDiagram), desc = diagramDesc(laidOutDiagram, opts.reveal);
        if (title) {
            a11y = ` role="img" aria-labelledby="svg-title${desc ? ' svg-desc' : ''}"`;
            head = `\n  <title id="svg-title">${escapeXml(title)}</title>${desc ? `\n  <desc id="svg-desc">${escapeXml(desc)}</desc>` : ''}`;
        }
        if (laidOutDiagram.source)
            head += `\n  <metadata id="svg-diagram">${escapeXml(JSON.stringify({ ...laidOutDiagram.source, ...(laidOutDiagram.status === undefined ? {} : { status: laidOutDiagram.status }), ...(opts.reveal === undefined ? {} : { reveal: opts.reveal }) }))}</metadata>`;
    }
    // transparent: no page rectangle; the root says which page colour the checks assume (lint-svg reads it as the starting background)
    const bgRect = laidOutDiagram.transparent ? '' : `\n  <rect x="0" y="0" width="${width}" height="${canvasHeight}" fill="${PALETTE.bg}"/>`;
    const assumed = laidOutDiagram.transparent ? ` data-assumed-bg="${PALETTE.bg}"` : '';
    const palette = customColors(laidOutDiagram.appearance), paletteAttr = palette.length ? ` data-palette="${[...new Set(palette)].join(' ')}"` : '', tonesAttr = toneColors(tones).length ? ` data-tone-colors="${[...new Set(toneColors(tones))].join(' ')}"` : '';
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${canvasHeight}" viewBox="0 0 ${width} ${canvasHeight}"${assumed}${a11y}>${head}${defs}
  <style>${style}
  </style>${bgRect}

  ${body}${connectSvg ? `\n\n  ${connectSvg}` : ''}
</svg>
`;
    // the attribute is added after the recolouring: its values are final colours (a custom white must not be recoloured as a light token)
    let out = opts.noRecolor ? svgText : recolor(tones, svgText, laidOutDiagram.appearance);
    const isAuto = laidOutDiagram.appearance === 'auto';
    if (isAuto)
        out = out.replace('\n  </style>', `${autoBlock(out, tones)}\n  </style>`); // ADR 0023 D2: the dark side, for the colours this figure uses
    const darkAttr = isAuto ? ' data-appearance="auto"' : mapOf(tones, laidOutDiagram.appearance) ? ' data-appearance="dark"' : '';
    // a canvas figure that lowered its text floor below 14px says so, for lint-svg (ADR 0017); every other figure is unchanged
    const minTextAttr = laidOutDiagram.canvas && laidOutDiagram.canvas.minText < MIN_FONT_SIZE ? ` data-min-text="${laidOutDiagram.canvas.minText}"` : '';
    return paletteAttr || darkAttr || tonesAttr || minTextAttr ? out.replace('<svg ', `<svg${darkAttr}${paletteAttr}${tonesAttr}${minTextAttr} `) : out;
}
