// string fields that are text a reader sees (a connect()'s from / to and every id are not)
const TEXT_KEYS = new Set(['title', 'body', 'label', 'text', 'caption', 'note', 'name', 'headline', 'sub', 'subtitle', 'tag', 'heading', 'lead', 'stamp', 'sourceLine', 'items', 'cells', 'rows', 'detail', 'desc']);
/** The strings of a diagram's bands that are meant to be read (labels, titles, bodies, table cells). */
export function textsOf(bands) {
    const out = [];
    const seen = new Set();
    const walk = (v, text) => {
        if (typeof v === 'string') {
            if (text && v.trim())
                out.push(v);
            return;
        }
        if (typeof v !== 'object' || v === null || seen.has(v))
            return;
        seen.add(v);
        if (Array.isArray(v)) {
            for (const x of v)
                walk(x, text);
            return;
        }
        for (const [k, x] of Object.entries(v))
            walk(x, TEXT_KEYS.has(k));
    };
    walk(bands, false);
    return out;
}
const KATAKANA = /[ァ-ヴー]{3,}/g;
const LATIN = /(?<![A-Za-z0-9_-])[A-Za-z]{3,}(?![A-Za-z0-9_-])/g; // words only: an id or a code with digits, - or _ (a12, aws-s3) is not a term
// all-lowercase and Capitalised are the same class (a word at the start of a sentence); ALLCAPS and camelCase are different classes
const caseClass = (w) => w === w.toUpperCase() ? 'upper' : w === w.toLowerCase() || w === (w[0] ?? '').toUpperCase() + w.slice(1).toLowerCase() ? 'plain' : 'mixed';
/** Spellings of one term that differ only by a trailing long vowel mark or by letter case class, inside one diagram. */
export function termVariants(texts) {
    const kana = new Map(), latin = new Map();
    for (const t of texts) {
        for (const m of t.matchAll(KATAKANA)) {
            const k = m[0].replace(/ー+$/, '');
            if (k.length >= 3)
                kana.set(k, (kana.get(k) ?? new Set()).add(m[0]));
        }
        for (const m of t.matchAll(LATIN)) {
            const k = m[0].toLowerCase();
            const byClass = latin.get(k) ?? new Map();
            if (!byClass.has(caseClass(m[0])))
                byClass.set(caseClass(m[0]), m[0]);
            latin.set(k, byClass);
        }
    }
    return [...[...kana.values()].filter(s => s.size > 1).map(s => [...s].sort()), ...[...latin.values()].filter(m => m.size > 1).map(m => [...m.values()].sort())];
}
/** `terms`: {"ユーザー": ["利用者", "ユーザ"]} — the preferred word and the spellings that should not appear. */
export function termFindings(bands, terms) {
    const texts = textsOf(bands), out = [];
    const variants = termVariants(texts).filter(v => !terms || !Object.entries(terms).some(([p, avoid]) => v.every(w => w === p || avoid.includes(w)))); // the glossary says it better
    for (const v of variants)
        out.push({ rule: 'term-variant', severity: 'warn', message: `同じ語の表記が揺れている: ${v.map(w => `「${w}」`).join(' と ')}。どちらかに揃える（揃える語を .svg-diagram.json の "terms" に書くと、全ての図で見張る）` });
    for (const [prefer, avoid] of Object.entries(terms ?? {})) {
        const hit = avoid.filter(a => a && texts.some(t => t.toLowerCase().includes(a.toLowerCase())));
        if (hit.length)
            out.push({ rule: 'term-avoid', severity: 'warn', message: `${hit.map(a => `「${a}」`).join('、')} は用語集で「${prefer}」に統一する語` });
    }
    return out;
}
// ---- numbers in tables ----------------------------------------------------------------------
const UNIT = '(%|％|円|万円|億円|千円|件|人|台|個|k|M|ms|s)?';
const NUM = new RegExp(`^[¥￥$]?\\s*(-?[\\d,]+(?:\\.\\d+)?)\\s*${UNIT}$`);
const TOTAL_WORD = /^(合計|総計|計|小計|総数|全体|total|sum|subtotal)$/i;
const SHARE_HEAD = /(構成比|割合|比率|シェア|share|%)/i;
export function parseNum(text) {
    const m = NUM.exec(text.trim());
    if (!m)
        return null;
    const raw = (m[1] ?? '').replace(/,/g, '');
    if (raw === '-' || raw === '')
        return null;
    return { value: Number(raw), decimals: raw.includes('.') ? (raw.split('.')[1] ?? '').length : 0, unit: (m[2] ?? '').replace('％', '%') };
}
const cellText = (c) => c === undefined ? '' : typeof c === 'string' ? c : typeof c === 'number' ? String(c) : c.text ?? '';
const cellsOf = (r) => Array.isArray(r) ? r : r.cells;
// the sum of `nums` must be `total`, give or take what rounding to the shown decimals can explain
function mismatch(nums, total) {
    if (!nums.length || nums.some(n => n.unit !== total.unit))
        return null;
    const d = Math.max(total.decimals, ...nums.map(n => n.decimals));
    const sum = parseFloat(nums.reduce((a, n) => a + n.value, 0).toFixed(d + 2));
    const ulp = 10 ** -d, tol = 0.5 * ulp * (total.unit === '%' ? nums.length : 1) + 1e-9;
    return Math.abs(sum - total.value) > tol ? sum : null;
}
const show = (v, unit, d) => `${parseFloat(v.toFixed(d))}${unit}`;
export function tableFindings(bands) {
    const out = [];
    for (const b of bands) {
        if (b.type !== 'table')
            continue;
        const t = b, name = t.title ? `表「${t.title}」` : '表';
        const grid = t.rows.map(r => cellsOf(r).map(cellText));
        const isTotalRow = grid.map(r => TOTAL_WORD.test((r[0] ?? '').trim()));
        // a 合計 row: each column's numbers above it (not past an earlier 小計 / 合計) add up to it
        grid.forEach((row, i) => {
            if (!isTotalRow[i])
                return;
            const sub = /^(小計|subtotal)$/i.test((row[0] ?? '').trim());
            for (let c = 1; c < row.length; c++) {
                const total = parseNum(row[c] ?? '');
                if (!total)
                    continue;
                const above = [], subs = [];
                for (let j = i - 1; j >= 0; j--) {
                    const gj = grid[j] ?? [];
                    if (isTotalRow[j]) {
                        const n = parseNum(gj[c] ?? '');
                        if (/^(小計|subtotal)$/i.test((gj[0] ?? '').trim()) && !sub && n) {
                            subs.push(n);
                            continue;
                        }
                        break;
                    }
                    const n = parseNum(gj[c] ?? '');
                    if (n)
                        above.push(n);
                }
                const bad = mismatch(above, total);
                if (bad !== null && (sub || mismatch(subs, total) !== null || !subs.length))
                    out.push({ rule: 'table-sum-mismatch', severity: 'warn', message: `${name}の「${(row[0] ?? '').trim()}」行 ${c + 1} 列目が ${show(total.value, total.unit, total.decimals)} だが、上の値の和は ${show(bad, total.unit, Math.max(total.decimals, ...above.map(n => n.decimals)))}` });
            }
        });
        // a 合計 column: the numbers to its left in each row add up to it
        t.columns.forEach((col, c) => {
            if (c === 0 || !TOTAL_WORD.test((col.label ?? '').trim()))
                return;
            grid.forEach((row, i) => {
                if (isTotalRow[i])
                    return;
                const total = parseNum(row[c] ?? '');
                const left = row.slice(1, c).map(parseNum).filter((n) => n !== null);
                const bad = total ? mismatch(left, total) : null;
                if (total && bad !== null)
                    out.push({ rule: 'table-sum-mismatch', severity: 'warn', message: `${name}の「${(row[0] ?? '').trim()}」行の「${col.label}」が ${show(total.value, total.unit, total.decimals)} だが、左の値の和は ${show(bad, total.unit, Math.max(total.decimals, ...left.map(n => n.decimals)))}` });
            });
        });
        // a share column (構成比 / 割合) with no 合計 row should add up to 100%
        t.columns.forEach((col, c) => {
            if (c === 0 || !SHARE_HEAD.test(col.label ?? '') || isTotalRow.some(Boolean))
                return;
            const nums = grid.map(r => parseNum(r[c] ?? '')).filter((n) => n !== null);
            if (nums.length < 2 || nums.some(n => n.unit !== '%'))
                return;
            const bad = mismatch(nums, { value: 100, decimals: 0, unit: '%' });
            if (bad !== null)
                out.push({ rule: 'table-share-not-100', severity: 'warn', message: `${name}の「${col.label}」列の合計が ${show(bad, '%', Math.max(...nums.map(n => n.decimals)))}（100% にならない。割合の取りこぼしか、複数選択なら見出しで断る）` });
        });
    }
    return out;
}
