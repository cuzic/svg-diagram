import { shape } from './html-frame.js';
function group(b, day, tones, _fb) {
    return b.frame === false ? '' : shape(b, b, day, tones, 'muted');
}
export const groupHtml = { type: 'group', accepts: b => !b.stamp, render: group };
