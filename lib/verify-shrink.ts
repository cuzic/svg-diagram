import {at} from './finding-rules.ts';
import type {LaidOutBpmn} from './types/diagrams.ts';
import type {LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import type {Finding} from './types/verdicts.ts';

/** Report text that broke into very short lines after fitting the diagram. */
export function narrowTextFindings(b: LaidOutBpmn | LaidOutSwimlane): Finding[] {
  if (!b.narrow?.length) return [];
  const what = b.type === 'bpmn' ? 'task' : 'step';
  return [{...at(b), rule: 'shrink-narrow-text', severity: 'warn', message: `fit: 'shrink' で詰めた結果、${what} の本文が 2〜3 字ずつ折れている（${b.narrow.slice(0, 3).map(t => `「${t}」`).join('')}${b.narrow.length > 3 ? ` ほか ${b.narrow.length - 3} 件` : ''}）。直し方: 図を縦向きにする、列の多い図を 2 つに分ける、文言を短くする、図の幅（maxWidth）を広げる`}];
}
