// `loopBack` on a row of steps / a horizontal chevron (ADR 0029 D4): the arrow that goes back to an earlier step, drawn under the boxes.
// Written as options of the band; a pre-layout pass turns each into an ordinary connect() with route 'loop-under' right after the band, with the
// lanes stepped so that no two loops cross or run at one height (hand-written loop-under connects keep the `dip` the author wrote).
import {loopBackConnectors} from './loop-back-connectors.ts';
import {chevronLoopBack, rowLoopBack} from './loop-back-source.ts';
import type {Band} from './types/index.ts';

/** Insert generated connectors immediately after their source in the complete renderer. */
export function expandLoopBacks(bands: Band[]): Band[] {
  let internal = 0;
  const visit = (list: Band[]): Band[] => list.flatMap(band => {
    if (band.type === 'group') band.children = visit(band.children);
    if (band.type === 'row' || band.type === 'chevron') {
      const source = band.type === 'row' ? rowLoopBack(band) : chevronLoopBack(band);
      if (source) return [band, ...loopBackConnectors(band, source, () => `__loopback${internal++}`)];
    }
    return [band];
  });
  return visit(bands);
}
