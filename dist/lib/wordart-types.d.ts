import type { Anchor, Dimmed, Rect, RevealOpts, Role, TextTone } from './types/core.ts';
/** A colour a wordart may use: a text tone, the page colour (a knocked-out letter) or the theme's pale colour. */
export type ArtTone = TextTone | 'bg' | 'soft';
export interface OutlineSpec {
    tone?: ArtTone; /** px outside the glyph (default: 6% of the size). */
    width?: number;
}
export interface ShadowSpec {
    tone?: ArtTone;
    dx?: number;
    dy?: number;
}
export interface GradientSpec {
    from: ArtTone;
    to: ArtTone; /** Degrees clockwise from left-to-right (0 = left to right, 90 = top to bottom; default 90). */
    angle?: number;
}
export interface GlowSpec {
    tone?: ArtTone; /** px the glow reaches past the letters (default: 25% of the size). */
    radius?: number;
}
export interface ExtrudeSpec {
    tone?: ArtTone; /** px the letters are pulled down and to the right (default: 10% of the size). */
    depth?: number;
}
export interface ReflectionSpec {
    opacity?: number; /** px between the letters and the mirror image. */
    gap?: number;
}
export type WordArtPreset = 'plain' | 'bold' | 'outline' | 'shadow' | 'sticker' | 'glow' | 'emboss' | '3d' | 'gradient' | 'reflect';
export interface WordArtOpts extends RevealOpts {
    id?: string;
    /** A look to start from; the other options override it. Default 'bold'. */
    style?: WordArtPreset;
    /** 'horizontal' (default) or 'vertical' (縦書き: columns from the right). */
    writing?: 'horizontal' | 'vertical';
    /** A role ('display' by default) or a size in px (at least 14). */
    size?: Role | number;
    weight?: 'normal' | 'bold';
    font?: 'sans' | 'mono';
    /** The letters' fill; 'none' leaves them hollow (an outline is then needed). */
    tone?: ArtTone | 'none';
    /** A fill that changes colour along a direction; it replaces `tone`. */
    gradient?: GradientSpec;
    /** An outline round the letters; an array stacks them from the inside out (a white halo inside a dark rim). */
    outline?: boolean | OutlineSpec | readonly OutlineSpec[];
    /** A hard shadow (no blur) down and to the right. */
    shadow?: boolean | ShadowSpec;
    /** A soft light round the letters (rings of the same colour, fading outwards: no blur filter). */
    glow?: boolean | GlowSpec;
    /** A raised edge: a light rim on the upper left, a dark one on the lower right. */
    bevel?: boolean;
    /** Depth (立体): the letters stacked back along a diagonal. */
    extrude?: boolean | ExtrudeSpec;
    /** A faded mirror image under the letters. */
    reflection?: boolean | ReflectionSpec;
    /** A filled plate under the text (a white-on-dark title). */
    plate?: ArtTone;
    /** Extra space between letters (px). */
    spacing?: number;
    /** Bends one horizontal line along an arc of this many degrees: positive arches up (虹形), negative sags (笑顔形). */
    arc?: number;
    /** Turns the whole figure by this many degrees clockwise. */
    rotate?: number;
    /** Mirrors the figure (applied before `rotate`). */
    flip?: 'horizontal' | 'vertical' | 'both';
    align?: 'start' | 'center' | 'end';
    /** The widest the text may be (px; horizontal: wraps), or the tallest a column may be (px; vertical: starts the next column). */
    limit?: number;
}
export interface WordArtBand extends RevealOpts {
    type: 'wordart';
    id?: string;
    text: string;
    opts: Omit<WordArtOpts, keyof RevealOpts | 'id'>;
}
/** The look of a wordart once the preset and the options are settled (sizes in px). */
export interface WordArtLook {
    /** px (the outline widths are judged against it). */
    size: number;
    weight: 400 | 700;
    font: 'sans' | 'mono';
    fill: ArtTone | 'none';
    gradient?: {
        from: ArtTone;
        to: ArtTone;
        angle: number;
    };
    /** Inside out. */
    outlines: {
        tone: ArtTone;
        width: number;
    }[];
    shadow?: {
        tone: ArtTone;
        dx: number;
        dy: number;
    };
    glow?: {
        tone: ArtTone;
        radius: number;
    };
    bevel?: {
        size: number;
    };
    extrude?: {
        tone: ArtTone;
        dx: number;
        dy: number;
    };
    reflection?: {
        opacity: number;
        gap: number;
    };
    plate?: ArtTone;
    spacing: number;
    arc?: number;
    rotate: number;
    flipH: boolean;
    flipV: boolean;
}
export type ArtItem = {
    k: 'line';
    text: string;
    x: number;
    y: number;
    anchor: 'start' | 'middle' | 'end';
    size: number;
}
/** Upright glyphs of one column: each is centred on x at its own baseline. */
 | {
    k: 'col';
    size: number;
    glyphs: {
        ch: string;
        x: number;
        y: number;
        size: number;
    }[];
}
/** A run turned 90° clockwise about (cx, cy): centred on x at baseline y before the turn. */
 | {
    k: 'rot';
    text: string;
    x: number;
    y: number;
    cx: number;
    cy: number;
    size: number;
}
/** Glyphs along an arc: each starts at (x, y) on its baseline and is turned `rot` degrees about that point. */
 | {
    k: 'arc';
    size: number;
    glyphs: {
        ch: string;
        x: number;
        y: number;
        rot: number;
    }[];
};
export interface LaidOutWordArt extends Rect, Dimmed {
    type: 'wordart';
    id?: string;
    reveal?: number;
    until?: number;
    /** Unique within the diagram (gradient / clip ids). */
    uid: string;
    text: string;
    size: number;
    writing: 'horizontal' | 'vertical';
    look: WordArtLook;
    /** The unturned figure, centred in the band's rect (the rect is the box of the turned figure). */
    local: Rect;
    items: ArtItem[];
    /** The plate, when the look has one (in the unturned figure). */
    plate?: Rect;
    /** The axis the mirror image is flipped about, and the strip of the letters (above it) that is kept. */
    reflection?: {
        axis: number;
        clip: Rect;
    };
    anchors: Anchor[];
    labelBoxes: (Rect & {
        label: string;
    })[];
}
/** An item moved by (dx, dy): its glyphs, its baseline and the pivot it turns about all move together. Pure. */
export declare function translateItem(it: ArtItem, dx: number, dy: number): ArtItem;
