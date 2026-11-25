import type { StateRowLoose, ValidateStateRows } from '../strict.ts';
import type { WfNode } from '../types/wireframe-nodes.ts';
import type { ScreensBand, StateMatrixOpts, PartRow, StateCellIn } from '../types/wireframe.ts';
export declare function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {
    required?: C[number][];
}): ScreensBand;
export declare function stateRow<const K extends string, O extends object = Record<string, unknown>, const L extends string = string>(label: L, part: ((o?: O) => WfNode) | ((o: O) => WfNode), states: {
    [P in K]: StateCellIn<NoInfer<O>>;
}, opts?: {
    note?: string;
    base?: Partial<NoInfer<O>>;
}): PartRow<K, L>;
