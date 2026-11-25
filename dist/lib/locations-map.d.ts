import type { ResolveSource } from './layout-issues.ts';
import type { SourceLoc } from './source-location.ts';
import type { DiagramSource, Rect } from './types/core.ts';
import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
import type { Issue } from './types/verdicts.ts';
type At = {
    loc: SourceLoc;
    via?: Omit<SourceLoc, 'file'>[];
};
type Life = {
    reveal?: number;
    until?: number;
};
type Visibility = Life & {
    final?: false;
};
type Part = At & Visibility & {
    kind: LaidOutBand['type'];
    label: string;
    rect: Rect;
    node?: string;
    generated?: true;
};
type Connection = At & Visibility & {
    kind: 'connect';
    label?: string;
    rect: Rect;
    segments: [number, number, number, number][];
};
export type LocationsProvenance = Pick<DiagramSource, 'sourceSha256' | 'configSha256' | 'noSourceLine'> & {
    depsSha256: string;
    tool: string;
};
export declare function locationsMap(diagram: LaidOutDiagram, source: string, provenance: LocationsProvenance, resolve: ResolveSource, issues?: readonly Issue[]): {
    version: 1;
    source: string;
    provenance: LocationsProvenance;
    width: number;
    height: number;
    diagram: {
        loc?: SourceLoc;
    };
    parts: Part[];
    connects: Connection[];
    issues?: ({
        via?: {
            line: number;
            column: number;
        }[] | undefined;
        related?: SourceLoc[] | undefined;
        file: string;
        rule: string;
        severity: 'error';
        message: string;
    } | {
        line: number;
        column: number;
        location?: undefined;
        via?: {
            line: number;
            column: number;
        }[] | undefined;
        related?: SourceLoc[] | undefined;
        file: string;
        rule: string;
        severity: 'error';
        message: string;
    } | {
        line?: undefined;
        column?: undefined;
        location: SourceLoc;
        via?: {
            line: number;
            column: number;
        }[] | undefined;
        related?: SourceLoc[] | undefined;
        file: string;
        rule: string;
        severity: 'error';
        message: string;
    })[] | undefined;
};
export {};
