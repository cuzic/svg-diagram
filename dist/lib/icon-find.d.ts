import type { InstallOpts } from './icon-install.ts';
import type { IconGlyph } from './icon-store.ts';
export type IconStyle = 'fill' | 'line' | 'color';
export interface Candidate {
    id: string;
    prefix: string;
    name: string;
    style: IconStyle;
    license: string;
    mainSet: boolean;
    glyph: IconGlyph;
    /** the `icons add` argument for it, named after the wanted word */
    add: string;
}
export interface FindOpts extends InstallOpts {
    /** only these sets */
    sets?: string[];
    /** only this look; `any` (default) takes all */
    style?: IconStyle | 'any';
    mainSet?: string;
    /** candidates kept per word (default 6) */
    limit?: number;
}
export declare function styleOf(g: IconGlyph): IconStyle;
export declare function findIcons(words: string[], opts?: FindOpts): Promise<{
    word: string;
    candidates: Candidate[];
    skipped: string[];
}[]>;
