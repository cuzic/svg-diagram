// The built-in character (ADR 0074 D3, "既定"): a head, a face of eyes / brows / mouth for the 8 expressions, hair, and shoulders, drawn from numbers only.
// No asset, deterministic, no licence to carry. The hue gives the hair and the clothes; the hair style is short or long.
//
// Every boundary between two fills inside the figure (the hair on the face, the head on the clothes, long hair on the shoulders) is drawn in three layers:
// a paper keyline, the ink line, a paper keyline (ADR 0076 A2 / D4). The ink line is then seen against the paper on both sides, whatever the two fills are. The outer
// edge of the figure (where it meets the panel) is the ink line alone.
import { COLOR, HEAD_R, f1 } from './constants.js';
const INK_W = 2.5, KEY_W = INK_W + 2 * 1.5;
const ink = (extra = '') => `fill="none" stroke="${COLOR.ink}" stroke-width="${INK_W}"${extra}`;
const key = () => `fill="none" stroke="${COLOR.paper}" stroke-width="${KEY_W}"`;
export const hairColor = (hue) => `hsl(${hue} 35% 28%)`;
export const clothesColor = (hue) => `hsl(${hue} 45% 62%)`;
const n = f1;
function features(kind, cx, cy) {
    const ex = 13, ey = cy + 1, my = cy + 15;
    const stroke = (d, w = 2.5) => `<path d="${d}" fill="none" stroke="${COLOR.ink}" stroke-width="${w}" stroke-linecap="round"/>`;
    const eye = (s) => {
        const x = cx + s * ex;
        switch (kind) {
            case 'laugh':
            case 'smile': return stroke(`M${n(x - 5)} ${n(ey + 2)}q5 -8 10 0`);
            case 'surprise': return `<circle cx="${n(x)}" cy="${n(ey)}" r="5.5" fill="${COLOR.paper}" stroke="${COLOR.ink}" stroke-width="2"/><circle cx="${n(x)}" cy="${n(ey)}" r="2" fill="${COLOR.ink}"/>`;
            case 'sad':
            case 'worry': return `<circle cx="${n(x)}" cy="${n(ey + 1)}" r="3.2" fill="${COLOR.ink}"/>`;
            default: return `<circle cx="${n(x)}" cy="${n(ey)}" r="3.4" fill="${COLOR.ink}"/>`;
        }
    };
    const brow = (s) => {
        const x = cx + s * ex;
        const tilt = kind === 'angry' ? -s * 5 : kind === 'worry' || kind === 'sad' ? s * 5 : kind === 'surprise' ? -4 : 0;
        const y = ey - 8 + (kind === 'surprise' ? -4 : 0);
        return stroke(`M${n(x - 6)} ${n(y - tilt / 2)}L${n(x + 6)} ${n(y + tilt / 2)}`, 2.4);
    };
    const mouth = {
        neutral: stroke(`M${cx - 6} ${n(my)}h12`, 2.4),
        smile: stroke(`M${cx - 9} ${n(my - 2)}q9 9 18 0`, 2.4),
        laugh: `<path d="M${cx - 10} ${n(my - 3)}h20a10 10 0 0 1 -20 0z" fill="${COLOR.filled}" stroke="${COLOR.ink}" stroke-width="2"/>`,
        surprise: `<ellipse cx="${cx}" cy="${n(my + 1)}" rx="4.5" ry="6" fill="${COLOR.filled}" stroke="${COLOR.ink}" stroke-width="2"/>`,
        worry: stroke(`M${cx - 7} ${n(my + 3)}q3.5 -5 7 0t7 0`, 2.2),
        angry: stroke(`M${cx - 8} ${n(my + 3)}q8 -7 16 0`, 2.4),
        think: `${stroke(`M${cx - 5} ${n(my)}h10`, 2.4)}<circle cx="${cx + 9}" cy="${n(my - 1)}" r="1.6" fill="${COLOR.ink}"/>`,
        sad: stroke(`M${cx - 7} ${n(my + 4)}q7 -8 14 0`, 2.4),
    }[kind];
    return brow(-1) + brow(1) + eye(-1) + eye(1) + mouth;
}
/** The two locks of long hair: they hang from the hairline beside the face and over the shoulders (the right one mirrors the left). */
function lock(cx, cy, side) {
    const x = (dx) => n(cx + side * dx);
    return `M${x(35.6)} ${n(cy - 5.4)}L${x(27)} ${n(cy - 9)}L${x(26)} ${n(cy + 52)}Q${x(35)} ${n(cy + 60)} ${x(44)} ${n(cy + 52)}Q${x(43)} ${n(cy + 8)} ${x(35.6)} ${n(cy - 5.4)}Z`;
}
/**
 * One person: the shoulders (cut by the panel's bottom edge), the head, the hair, the face. `idPrefix` makes the two clip paths unique in the SVG.
 * The head's centre is (cx, cy); the shoulders end on the panel's bottom edge, `HEAD_FROM_BOTTOM` below the centre.
 */
export function faceSvg(h, hue, hair, bottom, idPrefix) {
    const { cx, cy } = h, r = HEAD_R;
    const body = `M${cx - 56} ${bottom}c0 -34 20 -50 56 -50s56 16 56 50z`;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}"`;
    const cap = `M${n(cx - 35.6)} ${n(cy - 5.4)}A${r} ${r} 0 0 1 ${n(cx + 35.6)} ${n(cy - 5.4)}Q${cx} ${n(cy - 26)} ${n(cx - 35.6)} ${n(cy - 5.4)}Z`;
    const capArc = `M${n(cx - 35.6)} ${n(cy - 5.4)}A${r} ${r} 0 0 1 ${n(cx + 35.6)} ${n(cy - 5.4)}`;
    const hairline = `M${n(cx + 35.6)} ${n(cy - 5.4)}Q${cx} ${n(cy - 26)} ${n(cx - 35.6)} ${n(cy - 5.4)}`;
    const locks = hair === 'long' ? [lock(cx, cy, -1), lock(cx, cy, 1)] : [];
    const bodyClip = `${idPrefix}-body`, silClip = `${idPrefix}-sil`;
    return `<g data-face="${h.expression}">`
        + `<defs><clipPath id="${bodyClip}"><path d="${body}"/></clipPath><clipPath id="${silClip}"><path d="${body}"/>${circle}/></clipPath></defs>`
        // the clothes, then the head on them: the head's outer edge in ink, and where the head lies over the clothes, a boundary in three layers
        + `<path d="${body}" fill="${clothesColor(hue)}"/><path d="${body}" ${ink()}/>${circle} fill="${COLOR.skin}"/>${circle} ${ink()}/>`
        + `<g clip-path="url(#${bodyClip})">${circle} ${key()}/>${circle} ${ink()}/></g>`
        // the hair over the head and the clothes: its fill, then its outer edge in ink
        + `<path d="${cap}" fill="${hairColor(hue)}"/><path d="${capArc}" ${ink()}/>${locks.map(d => `<path d="${d}" fill="${hairColor(hue)}"/><path d="${d}" ${ink()}/>`).join('')}`
        // the hair's boundaries inside the figure, in three layers: on the face (the hairline, the inner edge of a lock), on the clothes (the foot of a lock)
        + `<g clip-path="url(#${silClip})"><path d="${hairline}" ${key()}/><path d="${hairline}" ${ink()}/>${locks.map(d => `<path d="${d}" ${key()}/><path d="${d}" ${ink()}/>`).join('')}</g>`
        + features(h.expression, cx, cy)
        + '</g>';
}
