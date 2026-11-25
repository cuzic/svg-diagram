export {caption} from './caption.ts';
export {box} from './box.ts';
export {stat} from './stat.ts';
export {banner} from './banner.ts';
// A labelled frame around other bands (a network zone, a service boundary, a
// release phase). children: any bands (row, grid, box, nested group...).
// tone: 'muted' (default, grey fill) | 'accent' | 'plain' (white) | 'danger';
// dashed: draw the boundary dashed (default true for 'plain' = a trust/zone line).
// frame: false draws no frame and no title (pad 0): a bare container, e.g. to put a table / plane / banner in a row() without a doubled outline.
// Types: the ids (and connect() refs) of the children are exposed to add().
export {group} from './group.ts';
export {legend} from './legend.ts';
export {raw} from './raw.ts';
