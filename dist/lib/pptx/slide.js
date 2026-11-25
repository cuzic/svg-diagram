import { diagramDesc, diagramTitle } from '../diagram-summary.js';
import { groupSpan } from './group-span.js';
import { swimlaneSpan } from './swimlane-span.js';
import { bandXml } from './bands.js';
import { planSlideWith } from './slide-core.js';
export { fontsOf } from './slide-core.js';
export function planSlide(ld, fonts) {
    const title = ld.medium === 'doc' ? diagramTitle(ld) : '';
    return planSlideWith(ld, fonts, bandXml, { title, desc: title ? diagramDesc(ld) : '', spans: { group: groupSpan, swimlane: swimlaneSpan } });
}
