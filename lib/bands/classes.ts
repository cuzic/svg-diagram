import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {classesTexts, layoutClassesBand} from '../classes.ts';
import {classDiagram as build} from '../dsl/classes.ts';
import {renderClasses} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import type {ClassesBand, ClassesOpts, LaidOutClasses, ClassItem, ClassRelation} from '../types/diagrams.ts';
import {classesProblems} from '../verify-classes.ts';
import {anchorRects} from '../verify-rects.ts';

const definition = {
  type: 'classes',
  ids: data => data.classes.map(item => item.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of classesTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const scope = scopeOf(data);
    const placed = layoutClassesBand(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false});
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderClasses(laid, theme, tones),
  verify: {
    rects: laid => anchorRects(laid),
    check: laid => classesProblems(laid).map(message => ({rule: 'classes', severity: 'problem', message})),
  },
} satisfies BandDef<ClassesBand, LaidOutClasses>;

export function classDiagram<const C extends readonly ClassItem[], const Id extends string = never>(
  classes: C, relations: readonly ClassRelation[], opts?: ClassesOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<C, Id>>, LaidOutClasses> {
  const data = build<C, Id>(classes, relations, opts);
  return band<typeof data, LaidOutClasses>(definition, data);
}
