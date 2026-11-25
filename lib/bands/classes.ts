import {layoutFitRules, layoutFitVerification} from '../verify-layout-fit.ts';
import {edgeBendFindings} from '../verify-edge-bends.ts';
import {textsAndLabels} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {classesTexts, layoutClassesBand} from '../classes.ts';
import {classDiagram as build} from '../dsl/classes.ts';
import {renderClasses} from '../emit-classes.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import type {ClassesBand, ClassesOpts, LaidOutClasses, ClassItem, ClassRelation} from '../types/diagrams.ts';
import {classesProblems} from '../verify-classes.ts';
import {anchorRects} from '../verify-rects.ts';

const definition = {
  type: 'classes',
  selfDimming: true,
  textSizes: textsAndLabels,
  ids: data => data.classes.map(item => item.id),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of classesTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap, keepWords = false, space}) {
    const scope = scopeOf(data);
    const placed = layoutClassesBand(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords, space});
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderClasses(laid, theme, tones),
  locations: {drawsFrame: (_laid, item) => item !== undefined},
  rules: layoutFitRules,
  verify: {
    ...layoutFitVerification,
    diagramFindings: edgeBendFindings,
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

/** @internal Definition used by the full renderer. */
export const classesDefinition: BandDef<ClassesBand, LaidOutClasses> = definition;
