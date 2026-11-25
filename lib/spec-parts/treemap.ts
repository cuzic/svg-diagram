import {AMOUNT, oneOf, text, items, list, object, withoutType} from '../spec-kit.ts';
import {unit, positive} from './r2-common.ts';
import type {PartDef, JsonSchema} from '../spec-kit.ts';

const MAX_TREEMAP_LEAVES = 40;

const treemapLeaf: JsonSchema = object({
  label: text('The name of the cell.', 30),
  value: {...AMOUNT, description: 'The area: more than 0.'},
  tone: {...oneOf('accent', 'danger'), description: 'A solid colour to make this cell stand out.'},
}, ['label', 'value']);
const treemapGroup: JsonSchema = object({
  label: text('The name of the cell, or of the group.', 30),
  value: {...AMOUNT, description: 'The area of a cell with no children: more than 0.'},
  tone: {...oneOf('accent', 'danger'), description: 'A solid colour to make this cell stand out (a cell with no children).'},
  children: list(treemapLeaf, 15, 1),
}, ['label']);

export function defineTreemapPart<Result>(builder: (tree: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'treemap',
    description: 'A treemap: shares of a whole as rectangles whose areas follow the values, such as sales by region and product. A cell with children is a group (its value is their sum); a cell too small for its name is drawn without it.',
    schema: object({
      type: {const: 'treemap'},
      items: list(treemapGroup, 15, 1),
      unit: unit(),
      percent: {type: 'boolean', description: "true: add each cell's share of the whole to its value."},
    }, ['type', 'items']),
    example: {type: 'treemap', unit: '億円', items: [{label: '国内', children: [{label: '東京', value: 40}, {label: '大阪', value: 22}, {label: '名古屋', value: 12}]}, {label: '海外', children: [{label: '北米', value: 30, tone: 'accent'}, {label: '欧州', value: 16}]}]},
    check(part, at, issues) {
      let leaves = 0;
      items(part, 'items').forEach((g, i) => {
        const p = `${at}.items[${i}]`, kids = items(g, 'children');
        if (kids.length) {
          if (g['value'] !== undefined) issues.push({path: `${p}.value`, message: 'a group takes the sum of its children: leave out its value'});
          if (g['tone'] !== undefined) issues.push({path: `${p}.tone`, message: 'only a cell with no children takes a tone'});
          kids.forEach((c, j) => positive(c['value'], `${p}.children[${j}].value`, 'an area', issues));
          leaves += kids.length;
        } else {
          if (g['value'] === undefined) issues.push({path: `${p}.value`, message: 'is required for a cell with no children'});
          else positive(g['value'], `${p}.value`, 'an area', issues);
          leaves += 1;
        }
      });
      if (leaves > MAX_TREEMAP_LEAVES) issues.push({path: `${at}.items`, message: `hold ${leaves} cells; the limit is ${MAX_TREEMAP_LEAVES}`});
    },
    build(part) {
      const {items: tree, ...opts} = withoutType(part);
      return builder(tree as never, opts as never);
    },
  };
}
