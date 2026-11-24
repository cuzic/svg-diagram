import {renderBoxRect, renderStamp} from './emit-box-frame.ts';
import {renderBoxText} from './emit-box-text.ts';
import type {ToneEnv} from './tokens.ts';
import type {Roles, Theme} from './types/core.ts';
import type {LaidOutBanner} from './types/text-bands.ts';

export function renderBanner(band: LaidOutBanner, day: Theme, tones: ToneEnv, roles: Roles): string {
  return `${renderBoxRect(band, day, tones, 'accent')}\n  ${renderBoxText(band, day, tones)}${renderStamp(band, roles)}`;
}
