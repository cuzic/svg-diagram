import type { Roles, Theme } from './types/core.ts';
import type { ArtTone, ExtrudeSpec, GlowSpec, GradientSpec, LaidOutWordArt, OutlineSpec, ReflectionSpec, ShadowSpec, WordArtBand, WordArtLook, WordArtOpts, WordArtPreset } from './wordart-types.ts';
export declare const isArtTone: (v: unknown) => boolean;
export declare const ART_TONE_NAMES: readonly string[];
export declare const WEIGHT_OF: Readonly<{
    readonly normal: 400;
    readonly bold: 700;
}>;
export declare const REFLECTION_SHARE = 0.6;
export declare const GLOW_RINGS = 4;
export declare const EXTRUDE_MAX_STEPS = 12;
/** A preset's widths are shares of the size (a px width would not scale with `size`). */
interface Preset {
    weight: 400 | 700;
    tone: ArtTone | 'none';
    gradient?: GradientSpec;
    outline?: readonly {
        tone: ArtTone;
        share: number;
    }[];
    shadow?: ShadowSpec;
    glow?: GlowSpec;
    bevel?: boolean;
    extrude?: ExtrudeSpec;
    reflection?: ReflectionSpec;
}
/** Presets as values: a look is data, not a code path. */
export declare const PRESETS: Readonly<Record<WordArtPreset, Preset>>;
export declare const asList: (o: WordArtOpts['outline']) => readonly OutlineSpec[] | undefined;
export declare function sizeOf(size: WordArtOpts['size'], roles: Roles): number;
/** The look of a wordart of `size` px: the preset, then each option on top of it. Pure; widths without a px value are shares of the size. */
export declare function resolveLook(opts: WordArtBand['opts'], size: number): WordArtLook;
/** How far the ink reaches past the glyph box: the outer outline, the glow, the bevel, and the shift of the shadow and of the depth. */
export declare function inkReach(look: WordArtLook): {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/** An outline thinner than this (px, for letters of `size`) is not a rim: it is a hairline, and does not make a letter read. */
export declare const minRim: (size: number) => number;
/** The colours a two-colour gradient passes through (sRGB, the SVG default), end to end. */
export declare function gradientSteps(from: string, to: string, n?: number): string[];
/**
 * Whether the letters read: their fill (every colour a gradient passes through) against what is behind them (the plate, else the page)
 * with 3:1 (large text), or — when the fill is too close to the ground, as a white letter on a white page — the fill against the
 * innermost outline and the outermost outline against the ground, both with 3:1, and both outlines thick enough to be seen (`minRim`).
 * Hollow letters read by their outline alone. `paint` is how the diagram recolours a token hex (its dark appearance): the colours are
 * judged as drawn. Returns the reason it does not, or null.
 */
export declare function legibilityProblem(look: WordArtLook, day: Theme, paint?: (hex: string) => string): string | null;
export interface PaintLayer {
    fill: string;
    stroke?: string;
    sw?: number;
    /** Where the copy of the text is drawn, relative to the text. */
    dx: number;
    dy: number;
    opacity?: number;
    /** Decoration: a copy that is not the text (aria-hidden and data-decor: read aloud and linted once, by the top layer). */
    hidden: boolean;
    /** Drawn flipped about the reflection axis. */
    mirror?: boolean;
    /** The top layer, the one that is the text. */
    text?: boolean;
}
/** The gradient a fill refers to, in the figure's own coordinates (the same for every run, so a vertical text's columns share one). */
/**
 * The id of a wordart's gradient: the figure's own id and the two colours it is drawn with. The colours are what a theme changes, and a
 * page with two SVGs of one figure in two themes would otherwise have two defs of one name.
 */
export declare function gradientId(art: LaidOutWordArt, day: Theme): string;
export declare function gradientOf(art: LaidOutWordArt, day: Theme): {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    from: string;
    to: string;
} | undefined;
/** The layers of a placed wordart for a theme, bottom to top: mirror image, shadow, glow, depth, outer outlines, bevel, the text. Pure. */
export declare function paintLayers(art: LaidOutWordArt, day: Theme, dim?: boolean): PaintLayer[];
/** The transform of a turned / mirrored figure about the band's centre, or null. Mirroring comes first. */
export declare function figureTransform(art: LaidOutWordArt): string | null;
export {};
