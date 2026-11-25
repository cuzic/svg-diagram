export function checkInsight(n) {
    const name = `wf.insight("${n.title ?? ''}")`;
    if (!n.evidence?.length)
        throw new Error(`${name}: evidence is required — an insight shows the data it rests on and when it was taken`);
    for (const e of n.evidence)
        if (!e.kind || !e.at)
            throw new Error(`${name}: every evidence needs {kind, at} — kind of data and its acquisition time`);
}
