import { scatterOpts } from '../qc-plane.js';
import { plane } from './plane.js';
export function scatter(points, opts) {
    if (!opts?.x || !opts?.y)
        throw new Error("scatter(points, {x, y}) needs the axes' names: {x: '温度', y: '不良率'}");
    return plane(scatterOpts(points, opts));
}
