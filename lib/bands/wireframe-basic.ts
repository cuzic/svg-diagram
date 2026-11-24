import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {wireframe as build} from '../dsl/wireframe.ts';
import {renderPrims} from '../emit-tables.ts';
import {appendScreen} from '../wireframe-placement.ts';
import type {LaidOutWireframe, WfRoot, WireframeBand, WireframeOpts} from '../types/wireframe.ts';
import {ownRect} from '../verify-rects.ts';
import type {WireframeRuntime} from '../wireframe-layout-core.ts';
import {basicWireframeRuntime, collectTextRequestsWith, layoutWireframeWith} from '../wireframe-layout-core.ts';

export function wireframeFor(runtime: WireframeRuntime) {
  const definition = {
    type: 'wireframe',
    internal: true,
    layout(data, ctx, x, width) {
      appendScreen(layoutWireframeWith(runtime, data, x, ctx.y, width, ctx.widthOf, ctx.tones, ctx.wrap), ctx);
    },
    measure(data, {atoms}) {
      for (const [text, size, weight, font] of collectTextRequestsWith(data, runtime)) atoms(text, size, weight, font);
    },
    emit: (laid, {theme}) => renderPrims(laid, theme),
    verify: {rects: ownRect},
  } satisfies BandDef<WireframeBand, LaidOutWireframe>;

  return function wireframe<const Id extends string = never>(root: WfRoot, opts?: WireframeOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutWireframe> {
    const data = build<Id>(root, opts);
    return band<typeof data, LaidOutWireframe>(definition, data);
  };
}

export const wireframe = /* @__PURE__ */ wireframeFor(basicWireframeRuntime);
