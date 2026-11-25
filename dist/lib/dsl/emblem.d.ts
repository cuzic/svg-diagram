import type { EmblemBand, EmblemItem, EmblemOpts } from '../flow-shapes.ts';
import type { Declares, HandleOf } from '../strict.ts';
import type { ShapeExtra } from './flow-types.ts';
/**
 * A word or two inside a circle, square, triangle, diamond or hexagon (図形に文字を入れたもの). The shape grows to hold its text, and all the
 * shapes of one band share a size; they wrap to the next row when the width runs out. `sub` is a smaller line under the label.
 *   emblem('重要', {shape: 'triangle', tone: 'danger', id: 'warn'})                      // one shape; `id` is its anchor
 *   emblem([{label: '課題', shape: 'hexagon'}, {label: '原因', sub: '3 件'}], {shape: 'circle'})   // several; `shape` is the default
 * Other tools call this a "shape" (PowerPoint, Visio) or a "node" (Graphviz, Mermaid). Item ids are anchors for connect() and spotlight.
 */
export declare function emblem<const Id extends string = never>(label: string, opts?: Omit<EmblemItem, 'label'> & Omit<EmblemOpts, 'shape' | 'id' | 'gap'> & {
    id?: Id;
}): EmblemBand & Declares<Id> & HandleOf<Id>;
export declare function emblem<const Id extends string = never, const I extends readonly EmblemItem[] = readonly EmblemItem[]>(items: I, opts?: EmblemOpts & {
    id?: Id;
}): ShapeExtra<EmblemBand, Id, I>;
