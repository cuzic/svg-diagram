export function textSvgDefs(band) {
    return { mono: band.wrappedRuns.some(run => run.mono) };
}
export function childTextSvgDefs(band) {
    return { mono: band.children.some(child => textSvgDefs(child).mono) };
}
