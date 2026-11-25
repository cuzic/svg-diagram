import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import {shape} from './html-frame.ts';
import {textRuns} from './html-text-runs.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutBanner} from './types/text-bands.ts';

function banner(b: LaidOutBanner, day: Theme, tones: ToneEnv, fb: FontBox): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, tones, 'accent') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'center', day, tones, fb, dim: b.dim, boxTone: b.tone});
}

export const bannerHtml: HtmlBandAdapter<'banner'> = {type: 'banner', accepts: b => !b.tagBox && !b.stamp, render: banner};
