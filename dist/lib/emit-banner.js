import { renderBoxRect, renderStamp } from './emit-box-frame.js';
import { renderBoxText } from './emit-box-text.js';
export function renderBanner(band, day, tones, roles) {
    return `${renderBoxRect(band, day, tones, 'accent')}\n  ${renderBoxText(band, day, tones)}${renderStamp(band, roles)}`;
}
