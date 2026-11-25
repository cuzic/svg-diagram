import { connectBand } from './defaults.js';
export function connect(from, to, opts = {}) {
    return connectBand(from, to, opts);
}
export { bracket } from './bracket.js';
export { callout } from './callout.js';
export { branch } from './branch.js';
