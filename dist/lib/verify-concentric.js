import { at } from './finding-rules.js';
/** ADR 0065: a mark of a concentric with sectors whose label found no spot clear of the ring and sector lines. */
export function concentricFindings(b) {
    return (b.crossings ?? []).map(label => ({ ...at(b), rule: 'concentric-label-crossing', severity: 'warn', message: `concentric: 印 "${label}" の見出しが輪の線か区切り線（stack では段・列の線）をまたぐか、stack の外枠の外に出る（近くに重ならない場所がない）。見出しを短くする、印を別の輪・扇形に移す、輪を減らす` }));
}
export const concentricRules = /* @__PURE__ */ Object.freeze({
    'concentric-label-crossing': { doc: 'concentric の扇形（sectors）の印の見出しが、輪の線か区切り線（layout: stack では段や列の線）をまたぐ、または stack の外枠の外に出る（重ならない場所が見つからなかった。ADR 0065）', scope: 'band' },
});
