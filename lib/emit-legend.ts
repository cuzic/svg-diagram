import type {SvgBandDefs} from './emit-svg-core.ts';
import {PALETTE, STRONG_STROKE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutLegend} from './types/containers.ts';
import type {Theme, Roles} from './types/core.ts';
import {LEGEND_SWATCH_W} from './layout-util.ts';
import {arrowPath, snap4, emojiSpan, lineAttrs, arrowMarkers, trimEnds, resolveBoxStyle} from './emit-common.ts';
import {ftaLegendSwatch} from './emit-fta-symbols.ts';

// A line sample (and optional arrowhead) + label per item, laid out by layout.ts.
export function legendSvgDefs(band: LaidOutLegend): SvgBandDefs {
  const arrow = band.items.some(item => item.line && (item.arrow ?? 'end') !== 'none');
  const strongArrow = band.items.some(item => item.weight === 'strong' && (item.arrow ?? 'end') !== 'none');
  return {arrow, strongArrow};
}

export function renderLegend(band: LaidOutLegend, day: Theme, tones: ToneEnv, roles: Roles): string {
  const parts: string[] = [];
  for (const it of band.items) {
    const cy = it.y + 12;
    if (it.ftaEvent || it.ftaGate) parts.push(ftaLegendSwatch(it, cy));
    else if (it.swatch || it.mark) { // a cause-tree entity (its role's box) or the core driver mark (a thick frame)
      const style = resolveBoxStyle(tones, it.swatch?.tone ?? 'plain', day, it.swatch?.dashed), x = it.x + 4, y = cy - 8;
      if (it.swatch?.hex) {
        const pts = ([[x + 6, y], [x + 22, y], [x + 28, cy], [x + 22, y + 16], [x + 6, y + 16], [x, cy]] satisfies [number, number][]).map(([px, py]) => `${snap4(px)},${snap4(py)}`).join(' ');
        parts.push(`<polygon points="${pts}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2"${style.dashed ? ' stroke-dasharray="6,4"' : ''} stroke-linejoin="round"/>`);
      } else {
        parts.push(`<rect x="${snap4(x)}" y="${snap4(y)}" width="28" height="16" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${it.mark ? 3.5 : 2.5}"${style.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
        if (it.swatch?.double) parts.push(`<rect x="${snap4(x + 3)}" y="${snap4(y + 3)}" width="22" height="10" rx="2" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`);
      }
    } else if (it.edge === 'and') { // two arrows joined by an arc across them
      for (const dy of [-5, 5]) parts.push(arrowPath([{x: it.x, y: cy + dy}, {x: it.x + LEGEND_SWATCH_W, y: cy + dy}], PALETTE.text, undefined));
      parts.push(`<path d="M${snap4(it.x + 14)},${cy - 5} Q${snap4(it.x + 20)},${cy} ${snap4(it.x + 14)},${cy + 5}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
    } else if (it.edge === 'back') { // a declared return: one bold arrow
      parts.push(arrowPath([{x: it.x, y: cy}, {x: it.x + LEGEND_SWATCH_W, y: cy}], PALETTE.text, undefined, 3));
    } else if (it.edge === 'blocks') { // a cutting arrow: dashed, ending in a bar
      parts.push(arrowPath([{x: it.x, y: cy}, {x: it.x + LEGEND_SWATCH_W, y: cy}], PALETTE.text, 'dashed', 2, 'end', 'bar'));
    } else if (it.line) {
      const strong = it.weight === 'strong', arrow = it.arrow ?? 'end';
      const [x1, x2] = strong ? trimEnds(it.x, it.x + LEGEND_SWATCH_W, arrow) : [it.x, it.x + LEGEND_SWATCH_W];
      const d = `M${snap4(x1)},${cy} L${snap4(x2)},${cy}`;
      if (strong) {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="${STRONG_STROKE}"${lineAttrs(it.line)}${arrowMarkers(arrow, false, true)}/>`);
      } else if (it.line === 'double') {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="6"/>`);
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.bg}" stroke-width="2"${arrowMarkers(it.arrow ?? 'end')}/>`);
      } else {
        parts.push(`<path d="${d}" fill="none" stroke="${PALETTE.text}" stroke-width="2"${lineAttrs(it.line)}${arrowMarkers(it.arrow ?? 'end')}/>`);
      }
    } else {
      const style = resolveBoxStyle(tones, it.tone ?? 'plain', day, it.dashed);
      parts.push(`<rect x="${snap4(it.x + 4)}" y="${snap4(cy - 8)}" width="28" height="16" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2.5"${style.dashed ? ' stroke-dasharray="6,4"' : ''}/>`);
    }
    parts.push(`<text x="${Math.round(it.x + LEGEND_SWATCH_W + 8)}" y="${cy + 5}" font-size="${roles.note}" fill="${PALETTE.text}">${emojiSpan(it.label)}</text>`);
  }
  return parts.join('\n  ');
}
