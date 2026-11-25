import { DEF } from './band-def.ts';
import { captionDefinition } from './bands/caption.ts';
import { connectDefinition } from './bands/connect.ts';
import { autoLegend } from './bands/legend.ts';
import { prepareBands } from './core.ts';
import type { BatchMeasurement } from './core.ts';
import { slideFitter } from './slide-fill.ts';
import { spotlighter } from './spotlight-core.ts';
import type { DiagramData } from './types/core.ts';
import type { Band, LaidOutDiagram } from './types/index.ts';
type DefinedBand = Band & {
    readonly [DEF]: object;
};
/** @internal Copy legacy bands and add the missing definitions throughout the band tree. */
export declare function attachDefinitions(d: DiagramData): DefinedBand[];
type DrawOptions = Parameters<typeof prepareBands>[1];
type LegacyOptions = (Pick<Extract<DrawOptions, {
    measure: unknown;
}>, 'measure'> | BatchMeasurement) & {
    budget?: DrawOptions['slide'] | null;
    nodeIds?: boolean;
    html?: boolean;
};
type LegacyServices = {
    spotlighter?: typeof spotlighter;
    fitter: typeof slideFitter;
    connectors: typeof connectDefinition;
    captions: typeof captionDefinition;
    autoLegend: typeof autoLegend;
};
export declare const legacySpotlighter: typeof spotlighter;
/** @internal Lay out and check a full-entry diagram using the band definitions. */
export declare function prepareLegacyDiagramWithCore(d: DiagramData, options: LegacyOptions, services?: LegacyServices): Promise<{
    placed: LaidOutDiagram;
    stage: number;
    verdict: import("./types/verdicts.ts").Verdict;
    emit: (figure: LaidOutDiagram, noRecolor?: boolean, description?: string | undefined, revealStage?: number | undefined) => string;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
}>;
/** @internal Draw a full-entry diagram using the band definitions. */
export declare function renderLegacyDiagramWithCore(d: DiagramData, options: LegacyOptions, services?: LegacyServices): Promise<{
    svg: string;
    width: number;
    height: number;
    xml: string[];
    laidOut: LaidOutDiagram;
    verdict: import("./types/verdicts.ts").Verdict;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
    stage: number;
    emit: (figure: LaidOutDiagram, noRecolor?: boolean, description?: string | undefined, revealStage?: number | undefined) => string;
    notes: string[];
}>;
export {};
