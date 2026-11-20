import type { Fonts } from './xml.ts';
/** The figure's shapes, or null when the SVG has something this does not read. Coordinates are the figure's own (the band's viewBox only crops). */
export declare function svgShapesXml(svg: string, fonts: Fonts, next: () => number): string | null;
