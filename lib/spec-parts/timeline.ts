import {list, object, oneOf, text} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {EN_MARK, english, withoutMarks, TL_DATE, TL_END, TL_TONE, remainingEn, checkTimeline} from './r3-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineTimelinePart<Result>(builder: (opts: never) => Result): PartDef<Result> {
  return {
    type: 'timeline',
    description: "A time axis, in one of two forms. Date form: dates are 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. Give any of now (today, always written out), the deadline the figure is about and marks (other dates); with both now and deadline the time left between them is written ('あと 1 年 3 か月'). from and to may be left out: the axis then runs from the first to the last date with a little padding. Number form: unit ('ms', '日' ...), from and to as numbers, lanes (rows), events (dots) and spans (bars, or a dimension line with dim).",
    schema: object({
      type: {const: 'timeline'},
      from: TL_END,
      to: TL_END,
      now: object({at: TL_DATE, label: text('Default 現在 (Now in English).', 20)}, ['at'], 'Date form: today. Always written out.'),
      deadline: object({at: TL_DATE, label: text('What ends then.', 30), line: {...oneOf('full'), description: "'full': a line through the whole figure."}}, ['at', 'label'], 'Date form: the date the figure is about.'),
      marks: list(object({at: TL_DATE, label: text('What happens then.', 30), tone: TL_TONE}, ['at', 'label']), 8),
      span: {...oneOf('bar', 'fill'), description: 'Date form: how the time left is drawn (default bar).'},
      remaining: {oneOf: [text('The words for the time left.', 30), {type: 'boolean', enum: [false]}], description: 'Date form: the words for the time left (default worked out), or false for none.'},
      unit: {type: 'string', maxLength: 6, description: "Number form: written after every value ('' for none)."},
      step: {type: 'number', minimum: 1e-9, maximum: 1e9, description: 'Number form: the tick spacing.'},
      lanes: list(text('A row, top to bottom. Up to 30 characters; a long name wraps in the lane column.', 30), 6, 1),
      events: list(object({at: {type: 'number', minimum: -1e9, maximum: 1e9}, label: text('What happens.', 30), lane: text('A lane.', 30), tone: TL_TONE}, ['at', 'label']), 20),
      spans: list(object({from: {type: 'number', minimum: -1e9, maximum: 1e9}, to: {type: 'number', minimum: -1e9, maximum: 1e9}, label: text('The text on it.', 30), lane: text('A lane.', 30), tone: TL_TONE, dim: {type: 'boolean', description: 'true: a dimension line with its length written above.'}}, ['from', 'to']), 20),
    }, ['type']),
    example: {type: 'timeline', from: '2026-01', to: '2027-12', now: {at: '2026-10'}, deadline: {at: '2027-06', label: '旧システムのサポート終了'}, marks: [{at: '2027-01', label: '移行開始'}]},
    en: {[EN_MARK]: 'en'},
    check: checkTimeline,
    build(part) {
      const opts = withoutMarks(part);
      if (english(part) && typeof opts['from'] !== 'number' && opts['unit'] === undefined) {
        const now = opts['now'] as Json | undefined, deadline = opts['deadline'] as Json | undefined;
        return builder({...opts, ...(now ? {now: {label: 'Now', ...now}} : {}), ...(opts['remaining'] === undefined && now && deadline ? {remaining: remainingEn(now['at'] as string, deadline['at'] as string)} : {})} as never);
      }
      return builder(opts as never);
    },
  };
}
