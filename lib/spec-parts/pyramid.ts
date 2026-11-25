import {list, object, text} from '../spec-kit.ts';
import type {PartDef} from '../spec-kit.ts';

export function definePyramidPart<Result>(builder: (layers: never) => Result): PartDef<Result> {
  return {
    type: 'pyramid',
    description: 'Layers stacked from a wide base to a narrow top, such as a hierarchy of needs or of priorities. The first layer is the base, the last the top.',
    schema: object({
      type: {const: 'pyramid'},
      layers: list(text('A layer, the base first.', 40), 7, 2),
    }, ['type', 'layers']),
    example: {type: 'pyramid', layers: ['日々の業務', '戦術', '戦略', 'ビジョン']},
    check() {},
    build(part) {
      return builder(part['layers'] as never);
    },
  };
}
