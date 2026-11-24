import {emitSvg} from '../emit.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import {bandPicture as pictureWith} from './image-band-core.ts';

export type {Picture} from './image-band-core.ts';

export function bandPicture(ld: LaidOutDiagram, band: LaidOutBand, index: number) {
  return pictureWith(ld, band, index, figure => emitSvg(figure, {noRecolor: true, parts: true}));
}
