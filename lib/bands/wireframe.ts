import {wireframeCalloutRules, wireframeCalloutVerification} from '../verify-wireframe-callouts.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {wireframe as build} from '../dsl/wireframe.ts';
import {renderPrims} from '../emit-wireframe.ts';
import {placeWireframe} from '../layout-wireframes.ts';
import type {LaidOutWireframe, WfRoot, WireframeBand, WireframeOpts} from '../types/wireframe.ts';
import {ownRect} from '../verify-rects.ts';
import {collectTextRequests} from '../wireframe.ts';

export {wf} from '../wireframe.ts';

const definition = {
  type: 'wireframe',
  offGrid: true,
  internal: true,
  layout: placeWireframe,
  measure(data, {atoms}) {
    for (const [text, size, weight, font] of collectTextRequests(data)) atoms(text, size, weight, font);
  },
  emit: (laid, {theme}) => renderPrims(laid, theme),
  rules: wireframeCalloutRules,
  verify: {rects: ownRect, ...wireframeCalloutVerification},
} satisfies BandDef<WireframeBand, LaidOutWireframe>;

export function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutWireframe> {
  const data = build<Id>(root, opts);
  return band<typeof data, LaidOutWireframe>(definition, data);
}
