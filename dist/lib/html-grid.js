import { boxHtml } from './html-box-band.js';
import { visibleAt } from './reveal-visibility.js';
export const gridHtml = {
    type: 'grid',
    accepts: b => b.children.every(boxHtml.accepts),
    render: (b, day, tones, fb, roles, stage) => b.children.filter(c => visibleAt(c, stage)).map(c => boxHtml.render(c, day, tones, fb, roles, stage)).join(''),
};
