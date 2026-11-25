import { band } from '../../band-def.js';
import { captionDefinition } from '../../bands/caption.js';
import { causeDefinition } from '../../bands/cause.js';
import { whyWhyTree as build } from '../../dsl/diagrams.js';
export function whyWhyTree(problem, whys, opts) {
    return build(problem, whys, opts).map(data => data.type === 'cause'
        ? band(causeDefinition, data)
        : band(captionDefinition, data));
}
