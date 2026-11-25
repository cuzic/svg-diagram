import { describeTable } from '../diagram-description.js';
import { tableNumberFindings } from '../table-number-rules.js';
import * as semantic from '../dsl/qc-semantic.js';
import { analysisFindings, findingAcceptanceHint } from '../finding-rules.js';
import { band } from '../band-def.js';
import { table as build } from '../dsl/table.js';
import { renderTable } from '../emit-table.js';
import { snapGrid } from '../layout-util.js';
import { rowHeaderFindings, semanticTableFindings, tableRules } from '../table-rules.js';
import { layoutTable, tableTexts } from '../layout-table.js';
export { cell } from '../dsl/table.js';
export const tableDefinition = {
    type: 'table',
    describe: data => ['structure', describeTable(data)],
    rules: tableRules,
    textSizes: band => [band.bodySize],
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of tableTexts(data, roles))
            atoms(text, size, weight, font);
    },
    layout(data, { x, y, w, widthOf, roles, wrap }) {
        const laid = layoutTable(data, x, snapGrid(y), w, widthOf, roles, wrap);
        return { laid, h: laid.h };
    },
    emit: (laid, { theme, tones, roles }) => renderTable(laid, theme, tones, roles),
    verify: {
        acceptHint: rule => Object.hasOwn(tableRules, rule) ? findingAcceptanceHint(rule) : undefined,
        findings: (data, { rcaCheck }) => [...analysisFindings(data, data.rca?.findings ?? [], rcaCheck === 'strict' ? 'warn' : 'info'), ...semanticTableFindings(data), ...tableNumberFindings(data)],
        layoutTones: laid => laid.rows.flatMap(row => !row.header && row.tone ? [row.tone] : []),
        layoutFindings: (laid, { tones }) => rowHeaderFindings(laid, tones),
    },
    svgDefs: laid => ({ mono: laid.rows.some(row => row.cells.some(cell => cell.mono && cell.lines.length)) }),
};
function attachTable(data) {
    return band(tableDefinition, data);
}
export function table(columns, rows, opts) {
    return attachTable(build(columns, rows, opts));
}
export function checkSheet(...args) {
    return attachTable(semantic.checkSheet(...args));
}
export function matrix(...args) {
    return attachTable(semantic.matrix(...args));
}
export function raci(...args) {
    return attachTable(semantic.raci(...args));
}
export function fmea(...args) {
    return attachTable(semantic.fmea(...args));
}
export function isIsNot(...args) {
    return attachTable(semantic.isIsNot(...args));
}
export function whyWhyTable(...args) {
    return attachTable(semantic.whyWhyTable(...args));
}
export function qfd(...args) {
    return attachTable(semantic.qfd(...args));
}
export function journeyMap(...args) {
    return attachTable(semantic.journeyMap(...args));
}
export function isIsNotTests(...args) {
    return attachTable(semantic.isIsNotTests(...args));
}
