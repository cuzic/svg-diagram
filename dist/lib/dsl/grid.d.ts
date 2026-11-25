import type { GridBand, GridOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
import type { Declares, IdsOf } from '../strict.ts';
export declare function grid<C extends BoxBand>(children: C[], opts: GridOpts): GridBand & Declares<IdsOf<C>>;
