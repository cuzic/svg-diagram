export const sizesOf = (xs) => xs.map(x => x.size);
const runSizes = (runs) => runs.map(r => r.size);
/** A band's own text runs (what box / caption / banner carry); any band that has them. */
export const ownRunSizes = (band) => 'wrappedRuns' in band ? runSizes(band.wrappedRuns) : [];
export const childRuns = (band) => band.children.flatMap(c => runSizes(c.wrappedRuns));
export const texts = band => sizesOf(band.texts);
export const textsAndLabels = band => [...sizesOf(band.texts), ...sizesOf(band.labels)];
