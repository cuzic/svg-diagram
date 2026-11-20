import { type LoadedDeck } from '../deck-load.ts';
import type { Config } from '../types/project.ts';
export interface RenderedSlide {
    /** The slide's SVG, and its SHA-256 (hex): the slide's URL is /s/<hash>.svg. */
    svg: string;
    hash: string;
    /** What the slide says, for <img alt>. */
    text: string;
    title: string;
    notes: string;
}
export interface RenderedDeck {
    title: string;
    /** One per slide; null where the slide could not be drawn (its problems are in `errors`). */
    slides: (RenderedSlide | null)[];
    /** Problems, each with its place: a slide with one is not drawn. */
    errors: string[];
    warnings: string[];
}
/** A slide drawn before, and what it was warned about (each warning's place after `slides[i]`, which is added for where the slide is now). */
export interface CachedSlide {
    slide: Omit<RenderedSlide, 'notes'>;
    warnings: {
        at: string;
        text: string;
    }[];
}
/** Drawn slides kept by what they were drawn from, so a save redraws only the slides it changed (ADR 0056 D5). */
export type SlideCache = Map<string, CachedSlide>;
/**
 * Every slide of `loaded` drawn. `fresh`: re-read the .ts figures (a watcher). `cache`: slides drawn before, by their input; a slide without
 * a .ts figure is taken from it when its input (all but the notes), the project's settings and `fontStamp` are the same. A slide with a .ts
 * figure (its own or a column's) is always drawn (what it imports is not in the key). The cache keeps only this deck's slides afterwards.
 */
export declare function renderDeck(loaded: LoadedDeck, cfg: Config, opts?: {
    fresh?: boolean;
    cache?: SlideCache;
    fontStamp?: string;
}): Promise<RenderedDeck>;
