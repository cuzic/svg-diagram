export function whole(band, { owner }) {
    if (!('h' in band))
        return [];
    const { type, x, y, w, h } = band;
    if (![x, y, w, h].every(Number.isFinite))
        return [];
    return [{ kind: 'whole', owner, band: type, rect: { x, y, w, h } }];
}
export function buildInventoryWith(itemsOf, laidOut, widthOf) {
    return laidOut.flatMap((band, i) => {
        const owner = ('id' in band ? band.id : undefined) ?? `${band.type}[${i}]`;
        return itemsOf(band, { owner, widthOf });
    });
}
