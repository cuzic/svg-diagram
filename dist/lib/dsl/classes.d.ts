import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ClassesBand, ClassesOpts, ClassItem, ClassRelation } from '../types/diagrams.ts';
type ClassIds<C extends readonly ClassItem[]> = Extract<C[number]['id'], string>;
/**
 * A UML class diagram: classes ({id, name?, stereotype?, abstract?, attrs?, methods?}) and relations ({from, to, kind?, label?,
 * fromMult?, toMult?}), placed in layers with parents on top. `inherit` / `implement` run child -> parent (triangle at the parent);
 * `compose` / `aggregate` put the diamond on `from`, the whole.
 *   classDiagram([{id: 'Animal', abstract: true, methods: ['+ eat()']}, {id: 'Dog', attrs: ['- name: string']}],
 *                [{from: 'Dog', to: 'Animal', kind: 'inherit'}])
 */
export declare function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {
    id?: Id;
}): ClassesBand & Declares<Id | ClassIds<C>> & HandleOf<Id> & AnchorsOf<ClassIds<C>>;
export {};
