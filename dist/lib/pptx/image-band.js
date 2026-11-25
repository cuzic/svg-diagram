import { emitSvg } from '../emit.js';
import { placedDefinitionOf } from '../placed-definitions.js';
import { bandPicture as pictureWith } from './image-band-core.js';
export function bandPicture(ld, band, index) {
    return pictureWith(ld, band, index, figure => emitSvg(figure, { noRecolor: true, parts: true }, placedDefinitionOf));
}
