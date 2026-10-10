import { closeMeasurer } from './measure.ts';
import type { Band, BannerBand, BannerOpts, BoxBand, BuildResult, RenderResult, CaptionBand, CaptionOpts, CheckResult, ConnectBand, PlaneBand, PlaneOpts, CurveBand, CurveOpts, Diagram, DiagramData, GridBand, GridOpts, GroupBand, GroupOpts, LegendBand, LegendItem, LegendOpts, PyramidBand, PyramidOpts, RawBand, RawOpts, RowBand, RowOpts, ScreensBand, ScreensOpts, SequenceBand, SequenceOpts, SpacerBand, StateMatrixOpts, SwimlaneBand, SwimlaneLane, SwimlaneOpts, TableBand, GroupRowBand, PartRow, StateCellIn, TableCellSpec, TableColumn, TableOpts, TableRow, WfNode, WfRoot, WireframeBand, WireframeOpts } from './types.ts';
import type { ActorIn, AnchorsOf, BoxInput, BranchInput, ConnectInput, CurvePoints, Declares, DiagramInput, FlowCheck, FlowIn, IdsOf, LaneCheck, Ok, HandleOf, PyramidLayers, Refers, RefsOf, RowHandleOf, SeqStepIn, ScreensItemInput, StateRowLoose, StepCheck, ValidateStateRows, StepIds, SwimlaneStepIn } from './strict.ts';
export { wf } from './wireframe.ts';
export type * from './types.ts';
export declare function diagram(opts: DiagramInput): Diagram<never>;
export declare function caption(text: string, opts?: CaptionOpts): CaptionBand;
export declare function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
export declare function banner<const Id extends string = never>(opts: BannerOpts & {
    id?: Id;
}): BannerBand & Declares<Id> & HandleOf<Id>;
export declare function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {
    id?: Id;
}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
export declare function legend(items: LegendItem[], opts?: LegendOpts): LegendBand;
export declare function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {
    id?: Id;
}): SequenceBand & Declares<Id> & HandleOf<Id>;
export declare function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {
    id?: Id;
}): TableBand & Declares<Id> & HandleOf<Id>;
export declare function cell(text: string | number, opts?: Omit<TableCellSpec, 'text'>): TableCellSpec;
export declare function swimlane<const L extends SwimlaneLane[], const S extends SwimlaneStepIn[], const F extends FlowIn[] = []>(lanes: L & LaneCheck<L>, steps: S & StepCheck<L, S>, opts?: Omit<SwimlaneOpts, 'flows'> & {
    flows?: F & FlowCheck<StepIds<S>, F>;
}): ((SwimlaneBand & Declares<StepIds<S>>) | ConnectBand)[] & AnchorsOf<StepIds<S>>;
export declare function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {
    id?: Id;
}): WireframeBand & Declares<Id> & HandleOf<Id>;
export declare function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): ScreensBand & Declares<Id> & AnchorsOf<Id>;
export declare function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {
    required?: C[number][];
}): ScreensBand;
export declare function stateRow<const K extends string, O extends object = Record<string, unknown>, const L extends string = string>(label: L, part: ((o?: O) => WfNode) | ((o: O) => WfNode), states: {
    [P in K]: StateCellIn<NoInfer<O>>;
}, opts?: {
    note?: string;
    base?: Partial<NoInfer<O>>;
}): PartRow<K, L>;
export declare function spacer(h: number): SpacerBand;
export declare function row<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export declare function row<C extends BoxBand | GroupBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export declare function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
export declare function connect<const F extends string, const T extends string>(from: Ok<F>, to: Ok<T>, opts?: ConnectInput): ConnectBand & Refers<F | T>;
export declare function branch<const F extends string, const To extends string>(from: Ok<F>, targets: (BranchInput & {
    to: Ok<To>;
})[], opts?: BranchInput): (ConnectBand & Refers<F | To>)[];
export declare function pyramid(layers: PyramidLayers, opts?: PyramidOpts): PyramidBand;
export declare function curve(points: CurvePoints, opts?: CurveOpts): CurveBand;
export declare function plane(opts: PlaneOpts): PlaneBand;
export declare function raw(opts: RawOpts): RawBand;
export declare function build(d: Diagram, outPath: string, opts?: {
    lint?: boolean;
    name?: string;
}): Promise<BuildResult>;
export declare function renderDiagram(d: Diagram, opts: {
    name: string;
    budget: 'measure' | 'cacheOnly';
}): Promise<RenderResult>;
export declare function checkDiagram(d: DiagramData): Promise<CheckResult>;
export { closeMeasurer };
