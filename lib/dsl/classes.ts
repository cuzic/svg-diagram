import {graphTones, resolveFocus} from '../focus.ts';
import {must} from '../must.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import type {ClassesBand, ClassesOpts, ClassItem, ClassRelation} from '../types/diagrams.ts';
import {revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle} from './shared.ts';

type ClassIds<C extends readonly ClassItem[]> = Extract<C[number]['id'], string>;
/**
 * A UML class diagram: classes ({id, name?, stereotype?, abstract?, attrs?, methods?}) and relations ({from, to, kind?, label?,
 * fromMult?, toMult?}), placed in layers with parents on top. `inherit` / `implement` run child -> parent (triangle at the parent);
 * `compose` / `aggregate` put the diamond on `from`, the whole.
 *   classDiagram([{id: 'Animal', abstract: true, methods: ['+ eat()']}, {id: 'Dog', attrs: ['- name: string']}],
 *                [{from: 'Dog', to: 'Animal', kind: 'inherit'}])
 */
export function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {id?: Id}): ClassesBand & Declares<Id | ClassIds<C>> & HandleOf<Id> & AnchorsOf<ClassIds<C>>;
export function classDiagram(classes: readonly ClassItem[], relations: readonly ClassRelation[], opts: ClassesOpts = {}): ClassesBand {
  if (!Array.isArray(classes) || classes.length === 0) throw new Error('classDiagram(classes, relations) needs at least one class');
  if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean') throw new Error(`classDiagram(): straighten must be true or false (got ${String(opts.straighten)})`);
  if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto') throw new Error(`classDiagram(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);

  for (const c of classes) if (c.tone !== undefined && !TREE_TONES.includes(c.tone)) throw new Error(`classDiagram(): class "${c.id}" has tone ${String(c.tone)} (use ${TREE_TONES.join(', ')})`);
  const band: ClassesBand = {type: 'classes', classes: [...classes], relations: [...relations], ...(opts.dir === undefined ? {} : {dir: opts.dir}), ...(opts.straighten === undefined ? {} : {straighten: opts.straighten}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'classDiagram()'), ...revealOf(opts)};
  if (opts.focus !== undefined) {
    const ids = classes.map(c => c.id), hit = resolveFocus(opts.focus, ids, 'classDiagram()');
    const tones = graphTones(ids.length, relations.map(r => [ids.indexOf(r.from), ids.indexOf(r.to)] as const), hit);
    band.classes = band.classes.map((c, i) => ({...c, tone: must(tones[i])}));
    band.focused = [...hit].map(i => must(ids[i]));
  }
  return withAnchors(withHandle(band, opts.id), classes.map(c => c.id));
}
