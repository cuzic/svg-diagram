import { type BandDescription } from './diagram-description.ts';
import type { BandDef, PublicEnv } from './band-def.ts';
import type { ChartGeom, LaidOutChartPart } from './charts-base.ts';
import type { ChartBand, LaidOutChart } from './charts.ts';
type ChartDefinition = BandDef<ChartBand, LaidOutChart>;
type MeasureEnv = Parameters<NonNullable<ChartDefinition['measure']>>[1];
export declare const describeChart: (data: ChartBand) => BandDescription;
export declare function measureChart(data: ChartBand, { atoms, roles }: MeasureEnv, texts: readonly [string, number][]): void;
export declare function layoutSelectiveChart(data: ChartBand, { x, y, w, widthOf, roles, wrap, geometryScale }: PublicEnv, layout: (g: ChartGeom) => LaidOutChartPart): {
    laid: LaidOutChart | {
        items: import("./charts-base.ts").ChartItem[];
        boxes: import("./charts-base.ts").ChartBox[];
        solids: import("./charts-base.ts").ChartSolid[];
        segs: import("./charts-base.ts").ChartSeg[];
        anchors: {
            id: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[];
        edges?: {
            from: string;
            to: string;
            points: {
                x: number;
                y: number;
            }[];
        }[];
        omitted: string[];
        type: 'chart';
        kind: import("./charts-base.ts").ChartKind;
        id?: string;
        alt: string;
        size: number;
        dimIds?: string[];
        reveal?: number;
        until?: number;
        x: number;
        y: number;
        w: number;
        h: number;
        dim?: boolean;
        scope: string;
    };
    h: number;
    anchors: {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }[];
};
export declare const chartIds: (data: ChartBand) => string[];
export declare const emitChart: ChartDefinition['emit'];
export declare const verifyChart: NonNullable<ChartDefinition['verify']>;
export {};
