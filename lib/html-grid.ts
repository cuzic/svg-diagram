import {boxHtml} from './html-box-band.ts';
import type {HtmlBandAdapter} from './html-adapter.ts';
import {visibleAt} from './reveal-visibility.ts';

export const gridHtml: HtmlBandAdapter<'grid'> = {
  type: 'grid',
  accepts: b => b.children.every(boxHtml.accepts),
  render: (b, day, tones, fb, roles, stage) => b.children.filter(c => visibleAt(c, stage)).map(c => boxHtml.render(c, day, tones, fb, roles, stage)).join(''),
};
