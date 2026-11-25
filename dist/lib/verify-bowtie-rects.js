export function bowtieRects(band) {
    return band.nodes.map((n, i) => ({ id: null, label: band.labelBoxes[i]?.label ?? 'box', x: n.x, y: n.y, w: n.w, h: n.h, ...(band.id ? { holds: [band.id] } : {}) }));
}
