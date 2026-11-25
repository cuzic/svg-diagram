import { band } from './band-def.js';
import { stateMatrix as buildMatrix } from './dsl/state-matrix.js';
import { screens as build } from './dsl/wireframe.js';
import { primRectGeometry, renderPrims } from './emit-wireframe.js';
import { frameRects } from './verify-rects.js';
export function screensDefinition(collect, place, findings) {
    return {
        type: 'screens',
        offGrid: true,
        internal: true,
        layout: place,
        ids: data => data.items.flatMap(item => item.id ? [item.id] : []),
        measure(data, { atoms }) {
            for (const [text, size, weight, font] of collect(data))
                atoms(text, size, weight, font);
        },
        emit: (laid, { theme }) => renderPrims(laid, theme),
        locations: {
            // The anchor includes the title above the frame. The frame shares its left, right and bottom edges.
            itemRect(laid, rect) {
                const bottom = rect.y + rect.h;
                const frame = laid.prims.find(p => p.k === 'rect' && p.x === rect.x && p.w === rect.w &&
                    p.y >= rect.y && Math.abs(p.y + p.h - bottom) < 1e-6);
                return frame?.k === 'rect' ? primRectGeometry(frame) : undefined;
            },
        },
        verify: { rects: frameRects, findings },
    };
}
export function screensBuilder(definition) {
    return function screens(items, opts) {
        const data = build(items, opts);
        return band(definition, data);
    };
}
export function stateMatrixBuilder(definition) {
    return function stateMatrix(cols, rows, opts) {
        return band(definition, buildMatrix(cols, rows, opts));
    };
}
