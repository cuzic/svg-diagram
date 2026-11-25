import { box } from './box.js';
export function node(opts) {
    const { label, sub, size, frame, ...rest } = opts;
    if (size !== undefined && !(size >= 16 && size <= 96))
        throw new Error(`node(): size must be between 16 and 96 px (got ${size})`);
    return box({ ...rest, title: label, ...(sub !== undefined ? { body: sub } : {}), iconAt: 'top', ...(size !== undefined ? { iconSize: size } : {}), ...(frame ? {} : { frame: false }), align: 'center' });
}
