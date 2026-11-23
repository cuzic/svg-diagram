// ADR 0080 spike: what the type-level totality does when ONE band type (the envelope `plugin`) joins the core unions.
// Not part of `pnpm typecheck` (spikes/ is outside its include). Run from the repo root:
//   node_modules/.bin/tsc --noEmit -p spikes/band-plugin/tsconfig.json
// Expected: exactly one error per core table below (each says "Property 'plugin' is missing"): the compiler lists the work, and no
// existing key regresses. The last two lines must compile: a plugin constructor's ids reach Diagram<Ids> through Declares<Id>.
import {BAND_HANDLERS} from '../../lib/pptx/bands.ts';
import {CHILD_BANDS, STACK_WIDTH} from '../../lib/band-children.ts';
import {EMIT_HANDLERS} from '../../lib/emit-handlers.ts';
import {FIT_HANDLERS} from '../../lib/fit-handlers.ts';
import {INVENTORY_HANDLERS} from '../../lib/inventory.ts';
import {LAYOUT_HANDLERS} from '../../lib/layout-handlers.ts';
import {MEASURE_HANDLERS} from '../../lib/layout-measure.ts';
import {REVEAL_HANDLERS} from '../../lib/reveal-handlers.ts';
import {VERIFY_HANDLERS} from '../../lib/verify-handlers.ts';
import type {Band, LaidOutBand} from '../../lib/types/index.ts';

interface PluginBand {type: 'plugin'; plugin: string; kind: string; data: unknown; id?: string}
interface LaidOutPlugin {type: 'plugin'; plugin: string; kind: string; x: number; y: number; w: number; h: number; laid: unknown}
type Band2 = Band | PluginBand;
type Laid2 = LaidOutBand | LaidOutPlugin;
type Total<K extends string> = Record<K, unknown>;

export const tables = {
  emit: EMIT_HANDLERS satisfies Total<Laid2['type']>,      // 1 (expected error)
  verify: VERIFY_HANDLERS satisfies Total<Laid2['type']>,  // 2
  fit: FIT_HANDLERS satisfies Total<Laid2['type']>,        // 3
  pptx: BAND_HANDLERS satisfies Total<Laid2['type']>,      // 4
  layout: LAYOUT_HANDLERS satisfies Total<Band2['type']>,  // 5
  reveal: REVEAL_HANDLERS satisfies Total<Band2['type']>,  // 6
  measure: MEASURE_HANDLERS satisfies Total<Band2['type']>, // 7
  children: CHILD_BANDS satisfies Total<Band2['type']>,    // 8
  stack: STACK_WIDTH satisfies Total<Band2['type']>,       // 9
  inventory: INVENTORY_HANDLERS satisfies Total<Laid2['type']>, // 10 (ADR 0078 U0a)
};
// control: the same tables against today's unions compile (so every error above is caused by 'plugin' alone)
export const control = [EMIT_HANDLERS satisfies Total<LaidOutBand['type']>, LAYOUT_HANDLERS satisfies Partial<Total<Band['type']>>, CHILD_BANDS satisfies Total<Band['type']>];
