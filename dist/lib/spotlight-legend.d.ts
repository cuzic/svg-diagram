import type { DiagramData } from './types/core.ts';
import type { Band } from './types/index.ts';
/** Input bands outside the spotlight. Used before layout so auto legends ignore their notation. */
export declare function dimmedBands(d: Pick<DiagramData, 'bands' | 'spotlight'>): Set<Band>;
