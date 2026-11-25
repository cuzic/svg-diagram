import { renderBoxRect, renderStamp } from './emit-box-frame.js';
export function renderGroup(band, day, tones, roles) {
    if (band.frame === false)
        return renderStamp(band, roles);
    return renderBoxRect(band, day, tones, 'muted') + renderStamp(band, roles);
}
