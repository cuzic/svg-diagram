import { dimChildren } from './emit-spotlight.js';
import { renderBox } from './emit-box.js';
import { visibleAt } from './reveal-visibility.js';
export function renderGrid(band, day, tones, roles, stage) {
    return band.children.filter(c => visibleAt(c, stage)).map(c => renderBox(c, day, tones, roles)).join('\n\n  ');
}
export const gridSpotlight = {
    targets: (band, id) => band.children.filter(c => c.id === id),
    dim: dimChildren,
};
