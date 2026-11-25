import type {LaidOutDiagram} from '../types/index.ts';
import {diagramDesc, diagramTitle} from '../diagram-summary.ts';
import {groupSpan} from './group-span.ts';
import {swimlaneSpan} from './swimlane-span.ts';
import {bandXml} from './bands.ts';
import {planSlideWith} from './slide-core.ts';
import type {SlidePlan} from './package.ts';
import type {Fonts} from './xml.ts';

export {fontsOf} from './slide-core.ts';

export function planSlide(ld: LaidOutDiagram, fonts: Fonts): SlidePlan {
  const title = ld.medium === 'doc' ? diagramTitle(ld) : '';
  return planSlideWith(ld, fonts, bandXml, {title, desc: title ? diagramDesc(ld) : '', spans: {group: groupSpan, swimlane: swimlaneSpan}});
}
