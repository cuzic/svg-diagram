import type { ConnectBand } from '../types/containers.ts';
import type { SequenceBand, SequenceOpts, SwimlaneBand, SwimlaneLane, SwimlaneOpts, TableBand, TableCellSpec, TableColumn, TableOpts, TableRow } from '../types/sequence-table-swimlane.ts';
import type { WfNode } from '../types/wireframe-nodes.ts';
import type { ScreensBand, StateMatrixOpts, PartRow, StateCellIn } from '../types/wireframe.ts';
import type { ActorIn, AnchorsOf, Declares, FlowCheck, FlowIn, LaneCheck, HandleOf, SeqStepIn, StateRowLoose, StepCheck, ValidateStateRows, StepIds, SwimlaneStepIn } from '../strict.ts';
export declare function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {
    id?: Id;
}): SequenceBand & Declares<Id> & HandleOf<Id>;
export declare function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {
    id?: Id;
}): TableBand & Declares<Id> & HandleOf<Id>;
export declare function cell(text: string | number, opts?: Omit<TableCellSpec, 'text'>): TableCellSpec;
export declare function swimlane<const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = [], const Id extends string = never>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows' | 'id'> & {
    id?: Id;
    flows?: F & FlowCheck<StepIds<S>, F>;
}): ((SwimlaneBand & Declares<StepIds<S> | Id>) | ConnectBand)[] & AnchorsOf<StepIds<S> | Id>;
export declare function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {
    required?: C[number][];
}): ScreensBand;
export declare function stateRow<const K extends string, O extends object = Record<string, unknown>, const L extends string = string>(label: L, part: ((o?: O) => WfNode) | ((o: O) => WfNode), states: {
    [P in K]: StateCellIn<NoInfer<O>>;
}, opts?: {
    note?: string;
    base?: Partial<NoInfer<O>>;
}): PartRow<K, L>;
