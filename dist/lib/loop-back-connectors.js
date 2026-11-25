import { connectBand } from './dsl/defaults.js';
import { sourceOf, withSource } from './source-ref.js';
/** The height of the first loop under the boxes, and how much each loop outside it adds (px). */
const DIP = 32, LANE = 28;
/** Turn validated loops into connectors, with shorter spans placed nearer their steps. */
export function loopBackConnectors(band, { loops, anchor }, nextId) {
    const id = band.id ?? (band.id = nextId());
    const byLane = (Array.isArray(loops) ? loops : [loops])
        .toSorted((x, y) => (x.from - x.to) - (y.from - y.to));
    const ref = sourceOf(band);
    return byLane.map((l, lane) => withSource(Object.assign(connectBand(`${anchor(id, l.from)}:bottom`, `${anchor(id, l.to)}:bottom`, {
        route: 'loop-under', dip: DIP + lane * LANE, ...(l.label === undefined ? {} : { label: l.label }), ...(l.chip === undefined ? {} : { chip: l.chip }), ...(l.tone === undefined ? {} : { tone: l.tone }), ...(l.line === undefined ? {} : { line: l.line }),
    }, false), { loopBack: true }), ref));
}
