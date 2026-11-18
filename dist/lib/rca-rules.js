const blank = (s) => s === undefined || !s.trim();
/** isisnot-no-isnot, isisnot-no-distinct-at-all: the specification table (what / where / when / extent). */
export function isIsNotFindings(rows, dimLabel) {
    const out = [];
    const noIsNot = rows.filter(r => blank(r.isNot)).map(r => `「${dimLabel(r.dim)}」`);
    if (noIsNot.length)
        out.push({ rule: 'isisnot-no-isnot', message: `IS NOT が空の行がある: ${noIsNot.join('、')}。比較対象（そうであってもおかしくないのに、そうでないもの）を書く` });
    if (rows.every(r => blank(r.distinct)))
        out.push({ rule: 'isisnot-no-distinct-at-all', message: '「違い」が 1 つも無い。IS と IS NOT で鋭く違う点（1 行に 1 つでよい）を挙げる' });
    return out;
}
/** The number of rows a hypothesis cannot explain. */
export const unexplained = (h) => h.results.filter(r => r === 'no').length;
/** The hypotheses that explain every row (no `no`), and, of those, the ones with the fewest assumptions. */
export function standingHypotheses(hs) {
    const standing = new Set();
    hs.forEach((h, i) => { if (unexplained(h) === 0)
        standing.add(i); });
    const least = Math.min(...[...standing].map(i => hs[i]?.assumes?.length ?? 0));
    const fewest = new Set([...standing].filter(i => (hs[i]?.assumes?.length ?? 0) === least));
    return { standing, fewest };
}
/** isisnot-no-hypothesis-stands: every hypothesis fails a row. Always info. */
export function isIsNotTestFindings(hs) {
    if (!hs.length || standingHypotheses(hs).standing.size)
        return [];
    return [{ rule: 'isisnot-no-hypothesis-stands', severity: 'info', message: '説明できない行が 0 の仮説が無い。原因はまだ分かっていない（新しい仮説を立てるか、スペックを見直す）' }];
}
/** The checks of the why-why table: a row is one chain. */
export function whyWhyTableFindings(chains) {
    const out = [];
    const label = (c, i) => `行 ${i + 1}「${c.whys.at(-1) ?? ''}」`;
    const noRoot = chains.map((c, i) => [c, i]).filter(([c]) => blank(c.trueCause));
    if (noRoot.length)
        out.push({ rule: 'whywhy-no-root', message: `真因（trueCause）の無い鎖がある: ${noRoot.map(([c, i]) => label(c, i)).join('、')}。どこまで掘ったかを真因として書く` });
    const sym = chains.map((c, i) => [c, i]).filter(([c]) => blank(c.trueCause) && !blank(c.measure));
    if (sym.length)
        out.push({ rule: 'whywhy-measure-without-root', message: `真因が無いのに対策（measure）がある: ${sym.map(([c, i]) => label(c, i)).join('、')}。症状への対策になっていないか確かめる` });
    if (chains.length === 1)
        out.push({ rule: 'whywhy-single-chain', severity: 'info', message: 'なぜなぜの鎖が 1 本だけ（分岐が無い）。原因が本当に 1 つに決まるか確かめる' });
    return out;
}
/** The checks of the why-why tree: the same rules as the table, on the nodes. */
export function whyWhyTreeFindings(whys) {
    const out = [];
    const leaves = [], symptom = [], dug = [];
    let branches = whys.length > 1;
    const walk = (n) => {
        const kids = n.because ?? [];
        if (kids.length > 1)
            branches = true;
        if (!kids.length && !n.trueCause)
            leaves.push(`「${n.why}」`);
        if (!blank(n.measure) && !n.trueCause)
            symptom.push(`「${n.why}」`);
        if (n.trueCause && kids.length)
            dug.push(`「${n.why}」`);
        kids.forEach(walk);
    };
    whys.forEach(walk);
    if (leaves.length)
        out.push({ rule: 'whywhy-no-root', message: `真因（trueCause: true）の無い葉がある: ${leaves.join('、')}。どこまで掘ったかを真因として印す` });
    if (symptom.length)
        out.push({ rule: 'whywhy-measure-without-root', message: `真因でない節に対策（measure）がある: ${symptom.join('、')}。症状への対策になっていないか確かめる` });
    if (!branches)
        out.push({ rule: 'whywhy-single-chain', severity: 'info', message: 'なぜなぜの木が 1 本の鎖だけ（分岐が無い）。原因が本当に 1 つに決まるか確かめる' });
    if (dug.length)
        out.push({ rule: 'whywhy-dig-below-root', severity: 'info', message: `真因の節の下にまだ「なぜ」がある: ${dug.join('、')}。真因より下を掘っている（真因の印の付け方を見直す）` });
    return out;
}
/** bowtie-barrier-missing: a threat or a consequence with no barrier at all. */
export function bowtieFindings(band) {
    const none = (list) => list.filter(s => !s.barriers?.length).map(s => `「${s.label}」`);
    const t = none(band.threats), c = none(band.consequences), out = [];
    if (t.length)
        out.push({ rule: 'bowtie-barrier-missing', message: `予防バリアが 1 つも無い脅威がある: ${t.join('、')}。防ぐ手を足すか、無いことを確かめる` });
    if (c.length)
        out.push({ rule: 'bowtie-barrier-missing', message: `低減バリアが 1 つも無い結果がある: ${c.join('、')}。和らげる手を足すか、無いことを確かめる` });
    return out;
}
