import { burndownOpts, burnupOpts, linesOpts, strategyCanvasOpts } from '../charts-lines.js';
import { plane } from './plane.js';
export function lines(series, opts = {}) {
    return plane(linesOpts(series, opts));
}
export function strategyCanvas(factors, series, opts = {}) {
    return lines(...strategyCanvasOpts(factors, series, opts));
}
export function burndown(spec, opts = {}) {
    return lines(...burndownOpts(spec, opts));
}
export function burnup(spec, opts = {}) {
    return lines(...burnupOpts(spec, opts));
}
