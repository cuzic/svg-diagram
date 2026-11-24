import {causalTexts} from './semnet-causal.ts';
import type {CausalSpec} from './semnet-causal.ts';
import {dependencyTexts} from './semnet-dependency.ts';
import type {DependencySpec} from './semnet-dependency.ts';
import {pertTexts} from './semnet-pert.ts';
import type {PertSpec} from './semnet-pert.ts';

export {causalAlt, layoutCausal, resolveCausal} from './semnet-causal.ts';
export type {CausalSpec, CausalNode, CausalOpts, CausalIntervention} from './semnet-causal.ts';
export {dependencyAlt, layoutDependency, resolveDependency} from './semnet-dependency.ts';
export type {DependencyEdge, DependencyEdgeType, DependencyNode, DependencyOpts, DependencySpec} from './semnet-dependency.ts';
export {pertAlt, layoutPert, resolvePert} from './semnet-pert.ts';
export type {PertOpts, PertSpec} from './semnet-pert.ts';
export type {SemnetDirection} from './semnet-common.ts';

export function semnetTexts(kind: 'pert' | 'causal' | 'dependency', spec: PertSpec | CausalSpec | DependencySpec): [string, number][] {
  if (kind === 'pert') return pertTexts(spec as PertSpec);
  if (kind === 'causal') return causalTexts(spec as CausalSpec);
  return dependencyTexts(spec as DependencySpec);
}
