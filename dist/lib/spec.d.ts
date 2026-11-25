export { capped, validateAgainst } from './spec-validation.ts';
export { cappedMessages, fieldsHolding, layoutIssue, lintMessages, locateMessage, locateVerdict } from './spec-result.ts';
export type { LocatedMessage, RenderSpecResult } from './spec-result.ts';
import type { Diagram } from './types/index.ts';
import type { Json, JsonSchema, SpecIssue } from './spec-kit.ts';
export { SPEC_VERSION, CANVAS_LIMITS, MAX_TOTAL_TEXT, MAX_EMOJI, MAX_SWIMLANE_COLS, MAX_TREE_DEPTH, MAX_TREE_NODES, MAX_CAUSE_NODES, MAX_CAUSE_LINKS, MAX_ISSUES, SpecError, withoutSchemaField } from './spec-kit.ts';
export type { JsonSchema, SpecIssue } from './spec-kit.ts';
export declare const specSchema: JsonSchema;
/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export declare function partCatalog(): {
    type: string;
    description: string;
    schema: JsonSchema;
    example: Json;
}[];
/** Every problem with `input`, each with its place; empty when specToDiagram() can take it. */
export declare function validateSpec(input: unknown): SpecIssue[];
/** The Diagram a valid spec describes (not drawn yet). Throws SpecError, with places, for anything wrong. */
export declare function specToDiagram(input: unknown): Diagram;
