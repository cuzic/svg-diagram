import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import {textRuns} from './html-text-runs.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutCaption} from './types/text-bands.ts';

function caption(b: LaidOutCaption, day: Theme, tones: ToneEnv, fb: FontBox): string {
  return textRuns(b.wrappedRuns, {originX: b.x, originY: b.y, w: b.w, align: b.align ?? 'center', day, tones, fb, dim: b.dim});
}

export const captionHtml: HtmlBandAdapter<'caption'> = {type: 'caption', accepts: b => !b.tagBox, render: caption};
