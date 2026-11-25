import { band } from '../../band-def.js';
import { captionDefinition } from '../../bands/caption.js';
import { statesDefinition } from '../../bands/states.js';
import { arrowDiagram as build } from '../../dsl/diagrams.js';
export function arrowDiagram(activities, opts) {
    return build(activities, opts).map(data => data.type === 'states'
        ? band(statesDefinition, data)
        : band(captionDefinition, data));
}
