import type { ChartGeom, LaidOutChartPart } from './charts-base.ts';
import type { CausalLink, CausalLoop, CausalPolarity } from './semnet-analysis.ts';
import type { SemnetDirection, SemnetOpts } from './semnet-common.ts';
export interface CausalNode {
    id: string;
    label: string;
}
/** A point of leverage outside the loop: an arrow from `id` to each node in `to`. It is not a loop member (it has no incoming edge), so R/B classification and loop names never change. */
export interface CausalIntervention {
    id: string;
    label: string;
    /** The node(s) it acts on; several give one arrow each (polarity and delay are shared). */
    to: string | readonly string[];
    /** Strengthening the intervention moves the target the same way (`+` / `same`) or the opposite way (`-` / `opposite`). Required. */
    polarity: CausalPolarity;
    delay?: boolean;
}
export interface CausalOpts extends SemnetOpts {
    interventions?: readonly CausalIntervention[];
    /** `'ring'`: the nodes of a graph that is exactly one loop go round an ellipse, the links are arcs (a node outside the loop is not allowed; `direction` is not either). Default `'layered'`. */
    layout?: 'layered' | 'ring';
}
export interface ResolvedIntervention {
    id: string;
    label: string;
    to: string[];
    polarity: CausalPolarity;
    delay: boolean;
}
export interface CausalSpec {
    nodes: CausalNode[];
    links: CausalLink[];
    loops: CausalLoop[];
    direction: SemnetDirection;
    interventions: ResolvedIntervention[];
    layout: 'layered' | 'ring';
    straighten: boolean;
}
export declare function resolveCausal(nodes: readonly CausalNode[], links: readonly CausalLink[], opts?: CausalOpts): CausalSpec;
export declare const causalAlt: (s: CausalSpec) => string;
export declare const causalTexts: (s: CausalSpec) => [string, number][];
export declare function layoutCausal(s: CausalSpec, g: ChartGeom): LaidOutChartPart;
