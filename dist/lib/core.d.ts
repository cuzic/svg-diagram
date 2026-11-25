import { DEF } from './band-def.ts';
import type { slideFitter } from './slide-fill.ts';
import type { spotlighter } from './spotlight-core.ts';
import type { BandDef } from './band-def.ts';
import type { CaptionBand, LaidOutCaption } from './types/text-bands.ts';
import type { ConnectBand, LaidOutConnect } from './types/containers.ts';
import type { RevealAnchor } from './reveal-warnings.ts';
import { toneEnv } from './tokens.ts';
import type { Appearance, Measured, MeasureRequest, DiagramData, RevealOpts, SlideCanvas, Theme } from './types/core.ts';
import type { Band, LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export type { BandDef } from './band-def.ts';
type DefinedBand = {
    type: string;
    id?: string;
    readonly [DEF]: object;
} & RevealOpts;
type Measure = (request: Required<MeasureRequest>) => Measured | Promise<Measured>;
/** @internal Measure the complete set of text atoms with a project backend. */
export type BatchMeasurement = {
    measureBatch: (requests: Map<string, Required<MeasureRequest>>) => Promise<ReadonlyMap<string, Measured>>;
};
type Options = {
    measure: Measure;
} & DrawOptions;
type DrawOptions = {
    width?: number | 'fit';
    slide?: {
        maxHeight: number;
        contentWidth: number;
    };
    fill?: boolean;
    fitter?: typeof slideFitter;
    /** @internal Effective slide text floor from a legacy diagram. */
    minEffectiveFont?: number;
    maxWidth?: number;
    legend?: DiagramData['legend'];
    spotlight?: DiagramData['spotlight'];
    spotlighter?: typeof spotlighter;
    accept?: DiagramData['accept'];
    diagramFindings?: (diagram: LaidOutDiagram, stage: number, definitionOf: (band: LaidOutBand) => BandDef | undefined) => Finding[];
    diagramAcceptHint?: (rule: string) => string | undefined;
    pad?: number;
    gap?: number;
    theme?: Theme;
    tones?: Parameters<typeof toneEnv>[0];
    wrap?: DiagramData['wrap'];
    keepWords?: boolean;
    title?: string;
    desc?: string;
    appearance?: Appearance;
    transparent?: boolean;
    tocCheck?: DiagramData['tocCheck'];
    rcaCheck?: DiagramData['rcaCheck'];
    layoutCheck?: DiagramData['layoutCheck'];
    legendLabels?: DiagramData['legendLabels'];
    /** @internal Append or extend a legend after generated connectors are present. */
    addAutoLegend?: (diagram: DiagramData) => void;
    density?: DiagramData['density'];
    showTitle?: boolean;
    sourceLine?: string;
    captions?: BandDef<CaptionBand, LaidOutCaption>;
    /** @internal Layout-generated children supplied by the full renderer. */
    generatedBands?: (data: Band) => readonly Band[];
    canvas?: Partial<SlideCanvas>;
    today?: string;
    stage?: number;
    connectors?: BandDef<ConnectBand, LaidOutConnect>;
};
type PreparationOptions = DrawOptions & ({
    measure: Measure;
} | BatchMeasurement) & {
    /** Diagram fields that travel with a full entry's laid-out result. */
    diagramData?: Omit<DiagramData, 'bands'>;
    /** Format the description after the defined bands supply it. */
    formatDescription?: (description: string) => string;
    /** Add reveal timing for synthetic anchors after visiting the band's children. */
    revealAnchorSlots?: (band: Band) => Iterable<readonly [string, RevealAnchor]>;
};
/** @internal Shared layout and SVG emission for selective output formats. */
export declare function prepareBands(bands: readonly DefinedBand[], opts: PreparationOptions): Promise<{
    placed: LaidOutDiagram;
    stage: number;
    verdict: import("./types/verdicts.ts").Verdict;
    emit: (figure: LaidOutDiagram, noRecolor?: boolean, description?: string | undefined, revealStage?: number | undefined) => string;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
}>;
/** Render a vertical stack of bands whose definitions are carried by their values. */
export declare function renderBands(bands: readonly DefinedBand[], opts: Options): Promise<{
    svg: string;
    width: number;
    height: number;
    xml: string[];
    verdict: import("./types/verdicts.ts").Verdict;
    fit: import("./types/verdicts.ts").FitReport;
    fontScale: number;
    laidOut: LaidOutDiagram;
}>;
