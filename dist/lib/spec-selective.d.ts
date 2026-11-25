import type { Config } from './types/project.ts';
import { renderBands, type BatchMeasurement } from './core.ts';
import type { Json, JsonSchema, PartDef, SpecIssue } from './spec-kit.ts';
type SelectedBand = Parameters<typeof renderBands>[0][number];
type Connectors = Parameters<typeof renderBands>[1]['connectors'];
export type SelectedPart = PartDef<SelectedBand | readonly SelectedBand[]> & {
    connectors?: Connectors;
};
export type { Json, JsonSchema, SpecIssue } from './spec-kit.ts';
export { SpecError } from './spec-kit.ts';
type PartOptions = {
    parts: readonly SelectedPart[];
    autoLegend?: (bands: readonly SelectedBand[], labels?: Partial<Record<string, string>>) => SelectedBand | undefined;
};
/** Schema of the parts supplied by the caller and the document options supported by renderBands. */
export declare function specSchemaFor({ parts, autoLegend }: PartOptions): JsonSchema;
export declare function partCatalog({ parts }: PartOptions): {
    type: string;
    description: string;
    schema: JsonSchema;
    example: Json;
}[];
type RenderOptions = Parameters<typeof renderBands>[1];
export declare function validateSpec(input: unknown, options: PartOptions): SpecIssue[];
type PrepareOptions = PartOptions & Pick<RenderOptions, 'captions'>;
type SpecProject = Pick<Config, 'wrap' | 'keepWords' | 'tones' | 'legend' | 'legendLabels' | 'maxWidth' | 'accept' | 'terms'>;
/** Document findings (mid-word breaks, terms, page-level checks) for `renderSpec`: spread into its options to opt in, `renderSpec(spec, {parts, measure, ...specFindings()})`. */
export declare function specFindings(terms?: SpecProject['terms']): Pick<RenderOptions, 'diagramFindings' | 'diagramAcceptHint'>;
/** @internal Include document diagnostics in the Node and Edge spec results. */
export declare function prepareVerifiedSpecRender(input: unknown, options: PrepareOptions): (measure: RenderOptions['measure']) => Promise<{
    svg: string;
    width: number;
    height: number;
    xml: string[];
    verdict: import("./types/verdicts.ts").Verdict;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
    laidOut: import("./types/index.ts").LaidOutDiagram;
}>;
/** @internal Provide the prepared geometry and SVG emitter to consumers such as the deck renderer. */
export declare function prepareSpecLayout(input: unknown, options: PrepareOptions & {
    project?: SpecProject;
}): (measurement: RenderOptions['measure'] | BatchMeasurement) => Promise<{
    placed: import("./types/index.ts").LaidOutDiagram;
    stage: number;
    verdict: import("./types/verdicts.ts").Verdict;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
    emit(figure: import("./types/index.ts").LaidOutDiagram, noRecolor?: boolean): string;
}>;
export declare function renderSpec(input: unknown, options: PartOptions & Pick<RenderOptions, 'measure' | 'captions' | 'diagramFindings' | 'diagramAcceptHint'>): Promise<{
    svg: string;
    width: number;
    height: number;
    xml: string[];
    verdict: import("./types/verdicts.ts").Verdict;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
    laidOut: import("./types/index.ts").LaidOutDiagram;
}>;
