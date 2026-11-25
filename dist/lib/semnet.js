import { causalTexts } from './semnet-causal.js';
import { dependencyTexts } from './semnet-dependency.js';
import { pertTexts } from './semnet-pert.js';
export { causalAlt, layoutCausal, resolveCausal } from './semnet-causal.js';
export { dependencyAlt, layoutDependency, resolveDependency } from './semnet-dependency.js';
export { pertAlt, layoutPert, resolvePert } from './semnet-pert.js';
export function semnetTexts(kind, spec) {
    if (kind === 'pert')
        return pertTexts(spec);
    if (kind === 'causal')
        return causalTexts(spec);
    return dependencyTexts(spec);
}
