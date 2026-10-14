// Shared by the wordart tests: a rough text width (no font files needed), a placer, and a box check.
import {layoutWordArt, wordartBand} from '../../lib/wordart.ts';
import {ROLES} from '../../lib/tokens.ts';
import type {Rect} from '../../lib/types/core.ts';

/** A rough width (0.58 em per character): enough to check the geometry without measuring fonts. */
export const rough = (atom: string, size: number): number => Array.from(atom).length * size * .58;
export const place = (text: string, opts = {}, width = 892) => layoutWordArt(wordartBand(text, opts), 24, 24, width, rough, ROLES);
export const inside = (t: Rect, f: Rect): boolean => t.x >= f.x - .5 && t.y >= f.y - .5 && t.x + t.w <= f.x + f.w + .5 && t.y + t.h <= f.y + f.h + .5;
