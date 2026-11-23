// Plugin authors use this entry with import type. The host supplies the runtime.
import type {BandDef} from './band-def.ts';
import type {Rect} from './types/core.ts';

export type {BandDef, PublicEnv, TextItem} from './band-def.ts';
export type {Anchor, ColorKey, Rect, Roles, Theme, WidthOf, WrapMode} from './types/core.ts';
export type {InventoryItem} from './types/inventory.ts';
export type {CheckRect} from './types/verdicts.ts';

type PublicBandDef<D, L extends Rect> = Extract<BandDef<D, L>, {internal?: never}>;

/** The host assigns the type from the plugin id and the band key. */
export type PluginBandDef<D extends object = object, L extends Rect = Rect, Input = unknown> =
  Omit<PublicBandDef<D, L>, 'type' | 'nodeIds' | 'rectsQualified' | 'children'> & {
    type?: string;
    build(input: Input): D;
    nodeIds?: 'host';
    rectsQualified?: false;
    children?: never;
  };

export type PluginDef = {
  id: string;
  apiVersion: string;
  version?: string;
  requires?: {svgDiagram: string};
  bands: Record<string, PluginBandDef>;
};
