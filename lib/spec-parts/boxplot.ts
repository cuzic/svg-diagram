import {NUM, items, list, object, oneOf, text, withoutType} from '../spec-kit.ts';
import {UNIT, MAX_VALUES, uniqueLabels} from './r6-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineBoxplotPart<Result>(builder: (groups: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'boxplot',
    description: 'A box plot: the spread of the raw values of each group, the box from the first to the third quartile with the median, whiskers to 1.5 IQR and the values beyond as rings. Compares groups such as branches, lines or months.',
    schema: object({
      type: {const: 'boxplot'},
      groups: list(object({label: text('The group.', 20), values: list(NUM, MAX_VALUES, 3)}, ['label', 'values']), 12, 1),
      label: text('The name of the value axis, with its unit.', 30),
      unit: UNIT,
      dir: {...oneOf('v', 'h'), description: 'v (default): the groups along the bottom. h: down the left.'},
      values: {...oneOf('median', 'mean', 'none'), description: "Write each group's median or mean beside it (default none)."},
      counts: {type: 'boolean', description: 'true: write n = … under each group.'},
      points: {type: 'boolean', description: 'true: draw every value as a point over the boxes.'},
    }, ['type', 'groups']),
    example: {type: 'boxplot', label: '待ち時間 (分)', groups: [{label: '本店', values: [5, 7, 8, 9, 10, 12, 14, 25]}, {label: '駅前店', values: [3, 4, 4, 5, 6, 7, 8, 9]}, {label: '郊外店', values: [8, 10, 11, 13, 15, 16, 18, 20]}]},
    check(part, at, issues) {
      const list = items(part, 'groups');
      uniqueLabels(list, `${at}.groups`, 'group', issues);
      const total = list.reduce((n, g) => n + (g['values'] as unknown[]).length, 0);
      if (total > 1200) issues.push({path: `${at}.groups`, message: `hold ${total} values; the limit is 1200`});
    },
    build(part) {
      const {groups, points, ...opts} = withoutType(part);
      return builder(groups as never, {...opts, ...(points === true ? {kind: ['box', 'strip']} : {})} as never);
    },
  };
}
