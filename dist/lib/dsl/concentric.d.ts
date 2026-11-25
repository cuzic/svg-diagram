import type { ConcentricBand, ConcentricMark, ConcentricOpts, ConcentricRing, ConcentricSector } from '../flow-shapes.ts';
import type { ShapeExtra } from './flow-types.ts';
/**
 * Nested rings, ordered from the outside or inside, with labels in the rings or in a side key.
 * With `sectors` (ADR 0065) the rings are cut into sectors from 12 o'clock clockwise and carry `marks` — the ACT Values Bullseye, a technology
 * radar. A mark sits in its sector at a ring (number as `rings` is written, or name) or at r (0 = centre, 1 = edge); `from` draws its move.
 *   concentric(4, {sectors: [{label: '仕事'}, {label: '家族'}], centre: '価値に沿った生き方', marks: [{label: '週1で運動', sector: 1, r: .3, from: {r: .7}}]})
 *   concentric([{label: 'Adopt'}, {label: 'Trial'}, {label: 'Assess'}, {label: 'Hold'}], {order: 'inner-first', sectors: [...], marks: [{label: 'Biome', sector: 2, ring: 'Adopt'}]})
 * `layout: 'stack'` draws the same data as a column of boxes per sector, a row per ring (the innermost at the top, the centre word over the columns).
 * `rings` may be a count of plain rings when there are sectors. Ring, sector and mark ids are anchors for connect() and spotlight.
 */
export declare function concentric<const Id extends string = never, const S extends readonly ConcentricSector[] = readonly ConcentricSector[], const M extends readonly ConcentricMark[] = readonly ConcentricMark[]>(rings: number, opts: ConcentricOpts & {
    id?: Id;
    sectors: S;
    marks?: M;
}): ShapeExtra<ConcentricBand, Id, [...S, ...M]>;
export declare function concentric<const Id extends string = never, const I extends readonly ConcentricRing[] = readonly ConcentricRing[], const S extends readonly ConcentricSector[] = readonly ConcentricSector[], const M extends readonly ConcentricMark[] = readonly ConcentricMark[]>(rings: I, opts?: ConcentricOpts & {
    id?: Id;
    sectors?: S;
    marks?: M;
}): ShapeExtra<ConcentricBand, Id, [...I, ...S, ...M]>;
