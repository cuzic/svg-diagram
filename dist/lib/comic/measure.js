// Pass 1 of the layout (ADR 0074 D5): the atoms the band needs measured. A full-width atom is never measured (it is 1 em), a blank is `max` em, so only
// the Latin runs of the literal text are registered (at the comic's one text size).
import { splitAtoms } from '../atoms.js';
import { FONT } from './constants.js';
import { parseTemplate } from './template.js';
import { isFullWidth } from './width.js';
export function comicMeasure(band) {
    const out = [];
    for (const p of band.sheet.panels)
        for (const d of p.dialogue) {
            for (const part of parseTemplate(d.tpl))
                if ('lit' in part)
                    for (const a of splitAtoms(part.lit))
                        if (!isFullWidth(a))
                            out.push([a, FONT, 400, 'sans']);
        }
    return out;
}
