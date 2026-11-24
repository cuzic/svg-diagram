import {shape} from './html-frame.ts';
import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme} from './types/core.ts';

function group(b: LaidOutGroup, day: Theme, tones: ToneEnv, _fb: FontBox): string {
  return b.frame === false ? '' : shape(b, b, day, tones, 'muted');
}

export const groupHtml: HtmlBandAdapter<'group'> = {type: 'group', accepts: b => !b.stamp, render: group};
