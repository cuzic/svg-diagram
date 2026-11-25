
import {PALETTE} from './tokens.ts';
import type {Roles} from './types/core.ts';
import type {LaidOutPyramid} from './types/figures.ts';
import {emojiSpan} from './emit-common.ts';

export function renderPyramid(band: LaidOutPyramid, roles: Roles): string {
  return band.layers.map(layer => {
    const pts = layer.points.map(([px, py]) => `${Math.round(px)},${Math.round(py)}`).join(' ');
    const accent = PALETTE[band.day].accent;
    const shape = `<polygon points="${pts}" fill="${accent}" fill-opacity="${layer.opacity}" stroke="${accent}" stroke-width="2.5"/>`;
    const text = layer.lines.map((line, i) =>
      `<text x="${Math.round(layer.cx)}" y="${layer.textYs[i]}" text-anchor="middle" font-size="${roles.title}" font-weight="700" fill="${layer.textColor}">${emojiSpan(line)}</text>`,
    ).join('\n  ');
    return `${shape}\n  ${text}`;
  }).join('\n\n  ');
}
