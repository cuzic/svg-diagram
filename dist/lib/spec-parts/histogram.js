import { NUM, list, object, withoutType } from '../spec-kit.js';
import { UNIT, MAX_VALUES } from './r6-common.js';
export function defineHistogramPart(builder) {
    return {
        type: 'histogram',
        description: 'A histogram (QC): the raw measurements are sorted into classes of a round width and drawn as touching bars. Give the specification limits (lsl, usl) to draw them and turn the classes outside red; the mean is drawn by default, the normal curve with normal: true.',
        schema: object({
            type: { const: 'histogram' },
            values: list({ ...NUM, description: 'One measurement.' }, MAX_VALUES, 2),
            unit: UNIT,
            bins: { type: 'integer', minimum: 3, maximum: 20, description: 'About how many classes (default from the count of values). Not with width.' },
            width: { type: 'number', minimum: 1e-9, maximum: 1e12, description: 'The class width. Not with bins.' },
            lsl: { ...NUM, description: 'The lower specification limit.' },
            usl: { ...NUM, description: 'The upper specification limit.' },
            target: { ...NUM, description: 'The target (nominal) value.' },
            mean: { type: 'boolean', description: 'false: do not draw the mean.' },
            normal: { type: 'boolean', description: 'true: draw the normal curve of the data.' },
        }, ['type', 'values']),
        example: { type: 'histogram', unit: 'mm', lsl: 9.6, usl: 10.4, values: [9.8, 10.1, 10.0, 10.2, 9.9, 10.0, 10.3, 9.7, 10.1, 10.0, 9.9, 10.2, 10.0, 10.1, 9.8, 10.5, 10.0, 9.9, 10.1, 10.0] },
        check(part, at, issues) {
            if (part['bins'] !== undefined && part['width'] !== undefined)
                issues.push({ path: `${at}.width`, message: 'give bins or width, not both' });
            if (typeof part['lsl'] === 'number' && typeof part['usl'] === 'number' && !(part['lsl'] < part['usl']))
                issues.push({ path: `${at}.usl`, message: `must be above lsl (${part['lsl']})` });
            const v = part['values'];
            if (v.every(x => x === v[0]))
                issues.push({ path: `${at}.values`, message: 'every value is the same: there is no spread to show' });
            if (typeof part['width'] === 'number') {
                const classes = (Math.max(...v) - Math.min(...v)) / part['width'];
                if (classes > 40)
                    issues.push({ path: `${at}.width`, message: `makes about ${Math.ceil(classes)} classes; at most 40 fit` });
            }
        },
        build(part) {
            const { values, ...opts } = withoutType(part);
            return builder(values, opts);
        },
        en: { lineWords: { lsl: 'LSL', usl: 'USL', target: 'Target', mean: 'Mean' } },
    };
}
