// Per-band-type text sizes for minTextSize(): every px size a laid-out band draws its text at, beyond its own wrappedRuns.
// One entry per band type, each checked against its own band type; a band type without one fails to compile.
const none = () => [];
const sizesOf = (xs) => xs.map(x => x.size);
const runSizes = (runs) => runs.map(r => r.size);
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export const ownRunSizes = (band) => 'wrappedRuns' in band ? runSizes(band.wrappedRuns) : [];
const childRuns = (band) => band.children.flatMap(c => runSizes(c.wrappedRuns));
const texts = band => sizesOf(band.texts);
const textsAndLabels = band => [...sizesOf(band.texts), ...sizesOf(band.labels)];
export const FIT_HANDLERS = {
    caption: none,
    status: band => [band.size],
    box: none,
    banner: none,
    group: none,
    legend: none,
    swimlane: none,
    wireframe: none,
    screens: none,
    sequence: none,
    table: band => [band.bodySize],
    row: childRuns,
    grid: childRuns,
    raw: none,
    pyramid: none,
    curve: none,
    plane: band => [band.labelSize],
    quadrant: texts,
    chevron: texts,
    wordart: band => [band.size],
    funnel: texts,
    cycle: texts,
    venn: texts,
    concentric: texts,
    emblem: texts,
    bars: texts,
    chart: band => [band.size],
    image: band => sizesOf(band.plates),
    people: none,
    dots: none,
    math: none,
    timeline: texts,
    tree: texts,
    states: textsAndLabels,
    cause: texts,
    cloud: band => [...sizesOf(band.texts), ...sizesOf(band.chips)],
    gantt: texts,
    classes: textsAndLabels,
    bpmn: textsAndLabels,
    fta: texts,
    bowtie: texts,
};
export const ALL_BANDS_FITTED = true;
/** Every text size one band draws: its own runs, then what its type adds. */
export function bandTextSizes(band) {
    return [...ownRunSizes(band), ...FIT_HANDLERS[band.type](band)];
}
