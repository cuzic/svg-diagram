import type { ScreensBand, ScreensOpts, WfRoot, WireframeBand, WireframeOpts } from '../types/wireframe.ts';
import type { AnchorsOf, Declares, HandleOf, ScreensItemInput } from '../strict.ts';
export declare function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {
    id?: Id;
}): WireframeBand & Declares<Id> & HandleOf<Id>;
export declare function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): ScreensBand & Declares<Id> & AnchorsOf<Id>;
