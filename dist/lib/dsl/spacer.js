import { assertNoReveal } from './shared.js';
export function spacer(h, opts) {
    assertNoReveal(opts, 'spacer()');
    return { type: 'spacer', h };
}
