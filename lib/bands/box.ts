import {boxItems} from '../inventory-boxes.ts';
import {oneLine} from '../diagram-description.ts';
import {frameLayoutFindings} from '../layout-metrics.ts';
import {band, walkDefinedBands} from '../band-def.ts';
import type {BandDef, DiagramFindings, WithBandDef} from '../band-def.ts';
import {box as buildBox} from '../dsl/box.ts';
import {textSvgDefs, renderBox} from '../emit-boxes.ts';
import {layoutBoxLikeBand} from '../layout-box-like.ts';
import {styledAtoms, textRuns} from '../layout-text.ts';
import type {BoxInput} from '../strict.ts';
import {TAG_SIZE} from '../tokens.ts';
import type {BoxBand, LaidOutBox} from '../types/text-bands.ts';
import {boxLikeContrastProblems, boxSizeFindings, nowrapProblems, statFitFindings} from '../verify-box-like.ts';
import {ownRect} from '../verify-rects.ts';

const selectedBoxSizeFindings: DiagramFindings = ({bands}) => boxSizeFindings(walkDefinedBands(bands));

export const boxDefinition: BandDef<BoxBand, LaidOutBox> = {
  type: 'box',
  inventory: boxItems,
  svgDefs: textSvgDefs,
  describe: data => data.title ? ['box', oneLine(data.title)] : undefined,
  measure(data, {atoms, roles}) {
    if (data.tag) atoms(data.tag, roles.tag ?? TAG_SIZE, 700);
    if (data.stamp) atoms(data.stamp, roles.note, 400);
    for (const run of textRuns(data, roles)) {
      const font = run.mono ? 'mono' : 'sans';
      for (let size = run.fit && run.nowrap ? run.fit.min : run.size; size <= run.size; size++) {
        for (const {text, weight} of styledAtoms(run)) atoms(text, size, weight, font);
      }
    }
  },
  internal: true,
  layout: layoutBoxLikeBand,
  emit(laid, {theme, tones, roles}) {
    return renderBox(laid, theme, tones, roles);
  },
  verify: {
    diagramFindings: [frameLayoutFindings, selectedBoxSizeFindings, statFitFindings],
    rects: ownRect,
    check: laid => nowrapProblems(laid).map(message => ({rule: 'nowrap', severity: 'problem', message})),
    contrast: (laid, {theme, tones, appearance}) => boxLikeContrastProblems(laid, laid.tone ?? 'plain', theme, tones, appearance),
  },
};

export function box<const Id extends string = never>(opts: BoxInput<Id>): WithBandDef<ReturnType<typeof buildBox<Id>>, LaidOutBox> {
  const data = buildBox<Id>(opts);
  return band<typeof data, LaidOutBox>(boxDefinition, data);
}

export {icon} from '../icon-registry.ts';
export {em} from '../rich.ts';
