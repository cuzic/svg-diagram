/** An item moved by (dx, dy): its glyphs, its baseline and the pivot it turns about all move together. Pure. */
export function translateItem(it, dx, dy) {
    switch (it.k) {
        case 'line': return { ...it, x: it.x + dx, y: it.y + dy };
        case 'col':
        case 'arc': return { ...it, glyphs: it.glyphs.map(g => ({ ...g, x: g.x + dx, y: g.y + dy })) };
        case 'rot': return { ...it, x: it.x + dx, y: it.y + dy, cx: it.cx + dx, cy: it.cy + dy };
    }
}
