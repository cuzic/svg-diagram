import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {gantt as buildGantt} from '../dsl/gantt.ts';
import {renderGantt} from '../emit-gantt.ts';
import {ganttTexts, layoutGantt} from '../gantt.ts';
import {snapGrid} from '../layout-util.ts';
import type {GanttBand, GanttOpts, GanttRow, LaidOutGantt} from '../types/timeline.ts';
import {ganttProblems} from '../verify-gantt.ts';

const withToday = (data: GanttBand, today: string | undefined): GanttBand =>
  data.today === 'auto' && today !== undefined ? {...data, today} : data;

const definition = {
  type: 'gantt',
  measure(data, {atoms, roles, today}) {
    for (const [text, size, weight, font] of ganttTexts(withToday(data, today), roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, today}) {
    const laid = layoutGantt(withToday(data, today), x, snapGrid(y), w, widthOf, roles);
    return {laid, h: laid.h};
  },
  emit(laid, {theme}) {
    return renderGantt(laid, theme);
  },
  verify: {
    check: laid => ganttProblems(laid).map(message => ({rule: 'gantt', severity: 'problem', message})),
  },
} satisfies BandDef<GanttBand, LaidOutGantt>;

export function gantt<const R extends readonly GanttRow[], const Id extends string = never>(rows: R, opts?: GanttOpts & {id?: Id}): WithBandDef<ReturnType<typeof buildGantt<R, Id>>, LaidOutGantt> {
  const data = buildGantt<R, Id>(rows, opts);
  return band<typeof data, LaidOutGantt>(definition, data);
}
