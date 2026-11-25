import type { BubbleOpts, BubblePoint } from '../charts-bubble.ts';
import type { ChartBand } from '../charts.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
export declare function bubbleBand(points: readonly BubblePoint[], opts: BubbleOpts): ChartBand;
/**
 * A bubble chart (バブルチャート): x and y on numeric axes, the AREA of the circle for a third measure (growth × share × revenue).
 * Every bubble is named; `x.line` / `y.line` draw a dashed threshold; a legend circle says what the area stands for.
 *   bubble([{label: 'A 事業', x: 1.8, y: 12, size: 520}, {label: 'B 事業', x: 0.6, y: 4, size: 180}], {x: {title: '相対シェア'}, y: {title: '市場成長率', unit: '%'}, sizeTitle: '売上', sizeUnit: '億円'})
 */
export declare function bubble<const P extends readonly BubblePoint[], const Id extends string = never>(points: P, opts?: BubbleOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<P>> & HandleOf<Id> & AnchorsOf<ChartIds<P>>;
