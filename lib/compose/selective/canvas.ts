import {band} from '../../band-def.ts';
import {boxDefinition} from '../../bands/box.ts';
import {gridDefinition} from '../../bands/grid.ts';
import {canvas as build} from '../canvas.ts';
import type {CanvasContent, CanvasOpts, CanvasTemplate} from '../canvas.ts';

export type {CanvasContent, CanvasKey, CanvasOpts, CanvasTemplate} from '../canvas.ts';

export function canvas<const T extends CanvasTemplate, const Id extends string = never>(
  template: T, content: CanvasContent<T>, opts?: CanvasOpts<T> & {id?: Id},
) {
  const data = build<T, Id>(template, content, opts);
  return band(gridDefinition, {...data, children: data.children.map(child => band(boxDefinition, child))});
}
