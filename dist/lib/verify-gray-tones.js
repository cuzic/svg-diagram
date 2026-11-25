import { resolveBoxStyle } from './emit-common.js';
import { fromSources } from './finding-rules.js';
import { must } from './must.js';
import { sourceOf } from './source-ref.js';
import { paintOf, relativeLuminance, toneStyle } from './tokens.js';
// In grayscale (a mono print, a colour-blind reader) only lightness is left. The fill of every tone a diagram uses (boxes, table rows),
// in the diagram's own theme and appearance, goes to CIE L* (0 black .. 100 white); two fills closer than GRAY_MIN_DL cannot be told apart.
// 10 is about where two flat greys stop reading as "different" on paper: it flags soft (L* ~93) next to plain white (100), and passes accent-soft against solid (~50). The de-emphasis tones (muted / removed: the pale code fill, grey text) are meant to sit back and are left out. Tones that differ in their dashed outline are told apart by shape; tones
// with the same fill (new / accent, changed / plain) are not told apart by their fill in colour either (the outline or nothing does it), so that is not this rule's matter.
export const GRAY_MIN_DL = 10;
const lightnessOf = (hex) => { const y = relativeLuminance(hex); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
export function grayToneFindings(d, tones, samples) {
    const used = new Map();
    const use = (name, band) => {
        const parts = used.get(name) ?? new Set();
        parts.add(band);
        used.set(name, parts);
    };
    for (const [band, names] of samples)
        for (const name of names)
            use(name, band);
    const p = paintOf(tones, d.appearance);
    const fills = [...used].map(([name, parts]) => {
        const t = toneStyle(tones, name), box = resolveBoxStyle(tones, name, d.day);
        return { name, parts, fill: p(box.fill).toLowerCase(), dashed: box.dashed, l: lightnessOf(p(box.fill)), quiet: t.fill === 'code' };
    });
    const hits = new Map(), parts = new Set();
    for (let i = 0; i < fills.length; i++)
        for (let j = i + 1; j < fills.length; j++) {
            const a = must(fills[i]), b = must(fills[j]);
            if (a.fill === b.fill || a.quiet || b.quiet || a.dashed !== b.dashed || Math.abs(a.l - b.l) >= GRAY_MIN_DL)
                continue;
            const pair = `${a.name}・${b.name}`;
            if (!hits.has(pair))
                hits.set(pair, `${pair}（L* ${Math.round(a.l)} と ${Math.round(b.l)}）`);
            for (const part of [...a.parts, ...b.parts])
                parts.add(part);
        }
    return hits.size ? [{ ...fromSources([...parts].map(b => sourceOf(b))), rule: 'gray-tone-collision', severity: 'warn', message: `白黒にすると塗りの明度が近く、見分けにくいトーンの組: ${[...hits.values()].join('、')}。直し方は 2 つ: (1) トーンの塗りの明度差を L* 10 以上にする（diagram({tones: {accent: {fill: '#…'}}}) か .svg-diagram.json の "tones" で色を変える。または片方を solid / muted にする）、(2) 破線・太字・ラベルなど色以外の手がかりを足し、accept: {'gray-tone-collision': '理由'} で許容する（確認は preview --gray）` }] : [];
}
