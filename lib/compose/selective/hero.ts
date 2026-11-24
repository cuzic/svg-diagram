import {band} from '../../band-def.ts';
import {bannerDefinition} from '../../bands/banner.ts';
import {boxDefinition} from '../../bands/box.ts';
import {captionDefinition} from '../../bands/caption.ts';
import {rowDefinition} from '../../bands/row.ts';
import type {BoxBand} from '../../types/text-bands.ts';
import {hero as build} from '../hero.ts';
import type {HeroOpts} from '../hero.ts';

export type {HeroOpts, HeroStat} from '../hero.ts';

export function hero<C extends BoxBand, const Id extends string = never>(opts: HeroOpts<C, Id>) {
  return build<C, Id>(opts).map(data => {
    if (data.type === 'banner') return band(bannerDefinition, data);
    if (data.type === 'caption') return band(captionDefinition, data);
    return band(rowDefinition, {...data, children: data.children.map(child => band(boxDefinition, child))});
  });
}
