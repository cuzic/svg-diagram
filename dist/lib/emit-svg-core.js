// Assembles the SVG document using renderers provided by the caller.
import { PALETTE, FONT_STACKS, STRONG_HEAD, STRONG_HEAD_REF_X, recolor, MIN_FONT_SIZE, customColors, mapOf, toneEnv, toneColors } from './tokens.js';
import { visibleAt } from './reveal-visibility.js';
import { escapeXml } from './emit-common.js';
import { autoBlock } from './appearance-auto.js';
export function emitSvgWith(services, laidOutDiagram, opts = {}) {
    const { renderBand, renderConnect, diagramTitle, diagramDesc, spotlightDim } = services;
    const tones = toneEnv(laidOutDiagram.tones);
    const { width, canvasHeight, day, laidOut, connects, roles } = laidOutDiagram;
    const bandDefs = laidOut.map(services.defsNeeded);
    const usesMono = bandDefs.some(d => d.mono);
    const connectorDefs = services.connectorDefs?.(connects, day, tones);
    const needsArrow = connectorDefs?.arrow || bandDefs.some(d => d.arrow);
    const needsDimArrow = connectorDefs?.dimArrow || bandDefs.some((d, i) => d.dimArrow || d.arrow && laidOut[i]?.dim);
    const needsStrongArrow = connectorDefs?.strongArrow || bandDefs.some(d => d.strongArrow);
    const needsDimStrongArrow = connectorDefs?.dimStrongArrow || bandDefs.some((d, i) => d.dimStrongArrow || d.strongArrow && laidOut[i]?.dim);
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
    </marker>` : ''}${connectorDefs?.markers ?? ''}${needsStrongArrow ? strongMarker('dsl-arrow-strong', PALETTE.text) : ''}${needsDimStrongArrow ? strongMarker('dsl-arrow-strong-dim', PALETTE.muted) : ''}
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
