import type { JsonSchema, PartDef } from './spec-kit.ts';
/** The document schema with the available parts and notation options of its renderer. */
export declare function schemaForParts(parts: readonly PartDef[], autoLegend?: boolean): JsonSchema;
