import type { Picture } from './image-band.ts';
export interface Entry {
    name: string;
    data: Uint8Array;
}
/** The one slide: its XML, its size (EMU) and the pictures it places (picture i is media/image{i+1}.png / .svg). */
export interface SlidePlan {
    xml: string;
    cx: number;
    cy: number;
    pictures: Picture[]; /** The figure's accessible name and description (the svg's <title> and <desc>): the file's title and description. */
    title?: string;
    desc?: string;
}
/** Relationship ids of picture i in the slide's rels (the template uses the ids below 12). */
export declare const imageRids: (i: number) => {
    png: string;
    svg: string;
};
/** The template with the slide size and rels filled in, plus the slide and its media; `[Content_Types].xml` first, the rest sorted by name. The template already declares png and svg. */
export declare function packageEntries(plan: SlidePlan, pngs: readonly Uint8Array[], template?: readonly {
    name: string;
    text: string;
}[]): Entry[];
