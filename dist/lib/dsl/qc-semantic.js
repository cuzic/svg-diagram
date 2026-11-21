import { controlChartOpts } from '../qc-plane.js';
import { ticksOf } from '../plane.js';
import { checkSheetParts, matrixParts } from '../qc-table.js';
import { fmeaParts, isIsNotDimLabel, isIsNotParts, isIsNotTestsParts, journeyMapParts, qfdParts, raciParts, whyWhyTableParts } from '../semantic-table.js';
import { isIsNotFindings, isIsNotTestFindings, whyWhyTableFindings } from '../rca-rules.js';
import { canvasBand } from '../canvas.js';
import { plane } from './figures.js';
import { table } from './sequence-table-swimlane.js';
export function controlChart(type, data, opts = {}) {
    return plane(controlChartOpts(type, data, opts));
}
export function xbarR(subgroups, opts = {}) {
    const { id, limits, yLabel, ...rest } = opts;
    const split = (v, what) => {
        const keys = v !== null && typeof v === 'object' ? Object.keys(v) : [];
        if (keys.some(k => k === 'xbar' || k === 'r') && !keys.every(k => k === 'xbar' || k === 'r'))
            throw new Error(`xbarR(): ${what} mixes xbar / r with other keys (${keys.join(', ')}); write {xbar: ..., r: ...} or one plain value`);
        return keys.length > 0 && keys.every(k => k === 'xbar' || k === 'r') ? v : { xbar: v };
    };
    const lim = split(limits, 'limits'), lab = split(yLabel, 'yLabel');
    const o1 = controlChartOpts('xbar', subgroups, { ...rest, ...(id === undefined ? {} : { id }), ...(lim.xbar === undefined ? {} : { limits: lim.xbar }), ...(lab.xbar === undefined ? {} : { yLabel: lab.xbar }) });
    const o2 = controlChartOpts('r', subgroups, { ...rest, ...(lim.r === undefined ? {} : { limits: lim.r }), ...(lab.r === undefined ? {} : { yLabel: lab.r }) });
    // the two charts are read down the page, sample by sample: they get the same left margin
    const labels = (o) => ticksOf(o.y).map(t => t.label);
    return [plane({ ...o1, yTickSample: labels(o2) }), plane({ ...o2, yTickSample: labels(o1) })];
}
export function checkSheet(items, columns, opts = {}) {
    const p = checkSheetParts(items, columns, opts);
    return table(p.columns, p.rows, p.opts);
}
export function matrix(rows, cols, cells, opts = {}) {
    const p = matrixParts(rows, cols, cells, opts);
    return table(p.columns, p.rows, p.opts);
}
export function raci(tasks, roles, assignments, opts = {}) {
    const p = raciParts(tasks, roles, assignments, opts), band = table(p.columns, p.rows, p.opts);
    if (p.emptyRoles.length)
        band.semanticWarnings = [`raci(): role column(s) have no assignments: ${p.emptyRoles.join(', ')}`];
    return band;
}
export function fmea(rows, opts = {}) {
    const p = fmeaParts(rows, opts);
    return table(p.columns, p.rows, p.opts);
}
export function isIsNot(rows, opts = {}) {
    const p = isIsNotParts(rows, opts), band = table(p.columns, p.rows, p.opts);
    band.rca = { kind: 'isisnot', findings: isIsNotFindings(rows, isIsNotDimLabel) };
    return band;
}
export function isIsNotTests(rows, hypotheses, opts = {}) {
    const p = isIsNotTestsParts(rows, hypotheses, opts), band = table(p.columns, p.rows, p.opts);
    band.rca = { kind: 'isisnot', findings: isIsNotTestFindings(p.hypotheses) };
    return band;
}
export function whyWhyTable(problem, chains, opts = {}) {
    const p = whyWhyTableParts(problem, chains, opts), band = table(p.columns, p.rows, p.opts);
    band.rca = { kind: 'whywhy-table', findings: whyWhyTableFindings(chains) };
    return band;
}
export function qfd(demands, characteristics, relations, opts = {}) {
    const p = qfdParts(demands, characteristics, relations, opts);
    return table(p.columns, p.rows, p.opts);
}
export function journeyMap(stages, lanes, opts = {}) {
    const p = journeyMapParts(stages, lanes, opts), band = table(p.columns, p.rows, p.opts);
    if (p.emotionCurve)
        band.rowCurve = p.emotionCurve;
    return band;
}
export function canvas(template, content, opts = {}) {
    return canvasBand(template, content, opts);
}
