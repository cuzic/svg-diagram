import { textWidth } from './atoms.js';
import { CAUSE_ROLES } from './cause-roles.js';
import { LEGEND_ITEM_GAP, LEGEND_ROW_H, LEGEND_SWATCH_W, snapGrid } from './layout-util.js';
import { must } from './must.js';
export function layoutLegend(band, padX, top, cw, widthOf, roles) {
    const y = snapGrid(top);
    const items = band.items.map(item => {
        const tw = textWidth(widthOf, item.label, roles.note, 400);
        const swatch = item.role ? { tone: CAUSE_ROLES[item.role].tone, ...(CAUSE_ROLES[item.role].double ? { double: true } : {}), ...(CAUSE_ROLES[item.role].dashed ? { dashed: true } : {}), ...(item.role === 'obstacle' || item.role === 'risk' ? { hex: true } : {}) } : undefined;
        return { ...item, ...(swatch ? { swatch } : {}), textW: tw, w: LEGEND_SWATCH_W + 8 + tw };
    });
    const rows = [[]];
    let rowW = 0;
    for (const it of items) {
        const add = (must(rows.at(-1)).length ? LEGEND_ITEM_GAP : 0) + it.w;
        if (must(rows.at(-1)).length && rowW + add > cw) {
            rows.push([]);
            rowW = 0;
        }
        rowW += (must(rows.at(-1)).length ? LEGEND_ITEM_GAP : 0) + it.w;
        must(rows.at(-1)).push(it);
    }
    const placedItems = [];
    rows.forEach((r, ri) => {
        const total = r.reduce((a, it) => a + it.w, 0) + (r.length - 1) * LEGEND_ITEM_GAP;
        let x = band.align === 'left' ? padX : padX + (cw - total) / 2;
        for (const it of r) {
            placedItems.push({ ...it, x, y: y + ri * (LEGEND_ROW_H + 8) });
            x += it.w + LEGEND_ITEM_GAP;
        }
    });
    const h = rows.length * LEGEND_ROW_H + (rows.length - 1) * 8;
    return { type: 'legend', x: padX, y, w: cw, h, items: placedItems };
}
