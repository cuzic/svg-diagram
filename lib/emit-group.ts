import {renderBoxRect, renderStamp} from './emit-box-frame.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Roles, Theme} from './types/core.ts';

export function renderGroup(band: LaidOutGroup, day: Theme, tones: ToneEnv, roles: Roles): string {
  if (band.frame === false) return renderStamp(band, roles);
  return renderBoxRect(band, day, tones, 'muted') + renderStamp(band, roles);
}
