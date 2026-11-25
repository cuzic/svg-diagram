import { band } from '../../band-def.js';
import { bannerDefinition } from '../../bands/banner.js';
import { boxDefinition } from '../../bands/box.js';
import { captionDefinition } from '../../bands/caption.js';
import { rowDefinition } from '../../bands/row.js';
import { hero as build } from '../hero.js';
export function hero(opts) {
    return build(opts).map(data => {
        if (data.type === 'banner')
            return band(bannerDefinition, data);
        if (data.type === 'caption')
            return band(captionDefinition, data);
        return band(rowDefinition, { ...data, children: data.children.map(child => band(boxDefinition, child)) });
    });
}
