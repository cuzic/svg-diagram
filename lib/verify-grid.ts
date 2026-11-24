import {at} from './finding-rules.ts';
import type {GridBand} from './types/containers.ts';
import type {Finding} from './types/verdicts.ts';

export function canvasRegionFindings(b: GridBand): Finding[] {
  if (!b.canvas?.requireAll || !b.canvas.empty.length) return [];
  return [{...at(b), rule: 'canvas-region-empty', severity: 'warn', message: `canvas("${b.canvas.template}") の領域 ${b.canvas.empty.join('、')} に内容がない。書くか、requireAll を外す`}];
}
