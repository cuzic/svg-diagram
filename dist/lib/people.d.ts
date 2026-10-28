import type { FontFamily, Theme, WidthOf, Roles } from './types/core.ts';
import type { DotsBand, LaidOutDots, LaidOutPeople, PeopleBand } from './types/people-dots.ts';
/** The person icon is drawn from the 4..20 square of its 24px box; the rest is margin. */
export declare const PERSON_BOX: {
    from: number;
    size: number;
};
/** people()'s own glyph (a head and shoulders, in the 24px box) — part of the primitive, not an installable icon. */
export declare const PERSON_PATH = "M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8M12 14c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z";
/** Every string a people() band draws beside its grid, registered before its geometry is calculated. */
export declare function peopleTexts(band: PeopleBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutPeople(band: PeopleBand, x: number, y: number, cw: number, widthOf: WidthOf, day: Theme, roles: Roles): LaidOutPeople;
/** Every string a dots() band draws, registered before its geometry is calculated. */
export declare function dotsTexts(band: DotsBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutDots(band: DotsBand, x: number, y: number, cw: number, widthOf: WidthOf, day: Theme, roles: Roles): LaidOutDots;
