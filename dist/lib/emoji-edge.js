/** The width of one emoji, in sizes: the system emoji fonts advance about 1.2 to 1.3 em. Room for the wider. */
export const EMOJI_EM = 1.25;
/** One emoji as it draws: a pictograph (or a keycap's digit), with its skin tone, variation selector, keycap mark, and the ones a zero-width
 *  joiner joins to it. */
const CLUSTER = /(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\p{Regional_Indicator}{2}|[0-9#*]\u{FE0F}?\u{20E3})(?:[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}]|\u{200D}\p{Extended_Pictographic}\u{FE0F}?)*/gu;
/** The marks inside an emoji that no font needs to list: the variation selector, the zero-width joiner, the keycap. */
const JOINING = new Set([0xfe0f, 0x200d, 0x20e3]);
/**
 * `text` cut into emoji and the runs between them, in order. An emoji is a pictograph cluster the font cannot draw (`covers`): one it
 * has (a ✓, a ★ in the CJK font) is text like any other. With no `covers`, every pictograph is an emoji.
 */
export function emojiParts(text, covers) {
    const out = [];
    let at = 0;
    for (const m of text.matchAll(CLUSTER)) {
        if (covers && [...m[0]].every(ch => { const cp = ch.codePointAt(0); return JOINING.has(cp) || covers(cp); }))
            continue;
        if (m.index > at)
            out.push({ s: text.slice(at, m.index), emoji: false });
        out.push({ s: m[0], emoji: true });
        at = m.index + m[0].length;
    }
    if (at < text.length)
        out.push({ s: text.slice(at), emoji: false });
    return out;
}
/** A measurer that gives each emoji (one `covers` says the font lacks) EMOJI_EM of the size and measures the rest with `measure`. */
export function emojiMeasurer(measure, covers) {
    return async (req) => {
        const parts = emojiParts(req.text, cp => covers(cp, req.font, req.weight));
        if (!parts.some(p => p.emoji))
            return measure(req);
        const rest = parts.filter(p => !p.emoji).map(p => p.s).join('');
        const m = rest ? await measure({ ...req, text: rest }) : await measure({ ...req, text: ' ' });
        const emoji = parts.filter(p => p.emoji).length * req.size * EMOJI_EM;
        return { w: (rest ? m.w : 0) + emoji, h: m.h };
    };
}
/** A text box function that gives each emoji (one `covers` says the font lacks) EMOJI_EM of the size and measures the rest with `box`. */
export function emojiTextBox(box, covers) {
    return (text, family, size, weight) => {
        const parts = emojiParts(text, cp => covers(cp, family, weight));
        if (!parts.some(p => p.emoji))
            return box(text, family, size, weight);
        const rest = parts.filter(p => !p.emoji).map(p => p.s).join('');
        const b = box(rest || ' ', family, size, weight);
        return { ...b, w: (rest ? b.w : 0) + parts.filter(p => p.emoji).length * size * EMOJI_EM };
    };
}
