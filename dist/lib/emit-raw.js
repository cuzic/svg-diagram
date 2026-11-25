import { PALETTE } from './tokens.js';
export function renderRaw(band, day) {
    const ctx = {
        x: band.x, y: band.y, w: band.w, h: band.h, day,
        color: (tone) => tone === 'accent' ? PALETTE[day].accent
            : tone === 'accent-soft' ? PALETTE[day].soft
                : PALETTE[tone] ?? PALETTE.text, // unknown tones fall back to text at runtime
    };
    return band.draw(ctx);
}
