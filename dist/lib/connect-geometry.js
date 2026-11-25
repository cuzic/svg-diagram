import { textWidth } from './atoms.js';
import { must } from './must.js';
import { CONNECT_LABEL_SIZE } from './tokens.js';
// 'id', 'id:side', or 'id:side@t' — t (0..1) slides the anchor along that side
// (default 0.5) so several connectors can leave/enter the same side in parallel.
export function parseRef(ref) {
    const [id, sideAt] = ref.split(':');
    const [side, at] = (sideAt ?? 'center').split('@');
    return { id: must(id), side: must(side), at: at === undefined ? 0.5 : Number(at) };
}
/** The width of a connect's label text (the chip, if any, is 16px wider). */
export const connectLabelWidth = (label, roles, widthOf) => textWidth(widthOf, label, roles.connectLabel ?? CONNECT_LABEL_SIZE, 400);
/**
 * The rectangle a connect's label takes, its text baseline at (labelX, labelY): the text itself, or, for a chip, the 24px-high pill 16px
 * wider than the text (then `labelBox` is the chip too). One formula for the layout and for labelRoom() (lib/connect-rules.ts, ADR 0069 D1).
 */
export function labelRects(labelWidth, roles, chip, labelX = 0, labelY = 0) {
    const size = roles.connectLabel ?? CONNECT_LABEL_SIZE;
    if (chip) {
        const chipBox = { x: labelX - (labelWidth + 16) / 2, y: labelY - 17, w: labelWidth + 16, h: 24 };
        return { labelBox: chipBox, chipBox };
    }
    return { labelBox: { x: labelX - labelWidth / 2, y: labelY - size, w: labelWidth, h: size + 4 } };
}
