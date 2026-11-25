import type { LaidOutOf } from '../band-table.ts';
import type { TextBox } from './shapes.ts';
import type { Ctx } from './adapter.ts';
/** A box or banner, with the parts a box may carry beside its frame. */
type BoxLike = TextBox & Pick<LaidOutOf<'box'>, 'id' | 'tag' | 'tagBox' | 'stamp' | 'stampW' | 'step' | 'icon'>;
export declare const boxPptx: (b: BoxLike, ctx: Ctx) => string;
export {};
