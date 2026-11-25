import type {Declares, HandleOf} from '../strict.ts';
import {wordartBand} from '../wordart.ts';
import type {WordArtBand, WordArtOpts} from '../wordart-types.ts';
import {withHandle} from './shared.ts';

/**
 * Decorated headline text (ワードアート): bold, outlined (縁取り), shadowed, glowing, bent, turned ..., set horizontally or vertically
 * (縦書き), as one band.
 *   wordart('新製品発表', {style: 'sticker', writing: 'vertical', size: 'display'})
 *   wordart('SALE', {style: 'outline', size: 72})
 * `style` picks a look ('plain' | 'bold' | 'outline' | 'shadow' | 'sticker' | 'glow' | 'emboss' | '3d' | 'gradient' | 'reflect'); `tone`,
 * `gradient`, `outline`, `shadow`, `glow`, `bevel`, `extrude`, `reflection`, `arc`, `rotate`, `flip`, `font`, `plate` adjust it.
 * Colours are tone keys. verifyDiagram() rejects letters that would not read (a white letter with no dark outline on a white page).
 */
export function wordart<const Id extends string = never>(text: string, opts?: WordArtOpts & {id?: Id}): WordArtBand & Declares<Id> & HandleOf<Id> { return withHandle(wordartBand(text, opts), opts?.id) as WordArtBand & Declares<Id> & HandleOf<Id>; }
