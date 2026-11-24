import {band} from '../band-def.ts';
import type {WithBandDef} from '../band-def.ts';
import {image as build} from '../dsl/image.ts';
import {resolveImageBand} from '../image-file.ts';
import type {ImageMark, ImageOpts, LaidOutImage} from '../types/image.ts';
import {imageDefinition} from './image.ts';
import type {SelectedBand} from './image.ts';

/** Read an image file before passing its band to the selective renderer. */
export function imageFile<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends SelectedBand | SelectedBand[] = []>(
  src: string | URL, opts: Omit<ImageOpts, 'over'> & {id?: Id; marks?: M; over?: C; baseDir?: string},
): WithBandDef<ReturnType<typeof build<M, Id, C>>, LaidOutImage> {
  const {baseDir = process.cwd(), ...options} = opts;
  const data = build<M, Id, C>(src, options);
  resolveImageBand(data, baseDir);
  return band<typeof data, LaidOutImage>(imageDefinition, data);
}
