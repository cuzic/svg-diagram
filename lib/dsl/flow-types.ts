import type {Declares, HandleOf} from '../strict.ts';

export type ItemIds<I extends readonly {id?: string}[]> = I[number] extends infer E ? E extends {readonly id: infer X extends string} ? X : never : never;
export type ShapeExtra<B, Id extends string, I extends readonly {id?: string}[]> = B & Declares<Id | ItemIds<I>> & HandleOf<Id>;
