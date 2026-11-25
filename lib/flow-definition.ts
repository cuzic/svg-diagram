import type {BandDef, PublicEnv} from './band-def.ts';
import {renderFlowShape} from './emit-flow-shape.ts';
import {placeFlowShape} from './flow-layout-core.ts';
import type {FlowLayout} from './flow-layout-core.ts';
import type {FlowShapeBand, LaidOutFlowShape} from './flow-types.ts';
import {snapGrid} from './layout-util.ts';
import type {FontFamily, Roles} from './types/core.ts';
import {flowProblems} from './verify-flow.ts';

type FlowDefinition = BandDef<FlowShapeBand, LaidOutFlowShape>;
type MeasureEnv = Parameters<NonNullable<FlowDefinition['measure']>>[1];

export function measureFlow<B extends FlowShapeBand>(
  data: B, {atoms, roles}: MeasureEnv, texts: (data: B, roles: Roles) => [string, number, number, FontFamily][],
): void {
  for (const [text, size, weight, font] of texts(data, roles)) atoms(text, size, weight, font);
}

export function placeFlow<B extends FlowShapeBand>(data: B, env: PublicEnv, draw: FlowLayout<B>) {
  const {x, y, w, widthOf, roles, wrap} = env;
  const placed = placeFlowShape(data, x, snapGrid(y), w, widthOf, roles, wrap, draw);
  const laid = data.scope ? {...placed, scope: data.scope} : placed;
  return {laid, h: laid.h, anchors: laid.anchors};
}

export function flowItemIds(items: readonly {id?: string}[]): string[] {
  return items.flatMap(item => item.id ? [item.id] : []);
}

export const emitFlow: FlowDefinition['emit'] = (laid, {theme, tones}) => renderFlowShape(laid, theme, tones);

export const verifyFlow: NonNullable<FlowDefinition['verify']> = {
  check: laid => flowProblems(laid).map(message => ({rule: 'flow', severity: 'problem', message})),
};
