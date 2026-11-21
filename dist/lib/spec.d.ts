import { SourceRef } from './source-ref.ts';
import type { RenderChecks } from './svg-lint.ts';
import type { Diagram, Verdict } from './types/index.ts';
import type { Json, JsonSchema, SpecIssue } from './spec-kit.ts';
export { SPEC_VERSION, CANVAS_LIMITS, MAX_TOTAL_TEXT, MAX_EMOJI, MAX_SWIMLANE_COLS, MAX_TREE_DEPTH, MAX_TREE_NODES, MAX_CAUSE_NODES, MAX_CAUSE_LINKS, MAX_ISSUES, SpecError, withoutSchemaField } from './spec-kit.ts';
export type { JsonSchema, SpecIssue } from './spec-kit.ts';
/** The JSON Schema of a whole spec. */
export declare const specSchema: JsonSchema;
/** The parts a spec can hold, for a caller that writes specs: what each is for, its schema and a small valid example. */
export declare function partCatalog(): {
    type: string;
    description: string;
    schema: JsonSchema;
    example: Json;
}[];
export declare const capped: (issues: SpecIssue[]) => SpecIssue[];
/** Every problem with `input`, each with its place; empty when specToDiagram() can take it. */
export declare function validateSpec(input: unknown): SpecIssue[];
/** The Diagram a valid spec describes (not drawn yet). Throws SpecError, with places, for anything wrong. */
export declare function specToDiagram(input: unknown): Diagram;
/** A message from drawing or checking, with the place in the spec it is about. `path` is null when the message names nothing in the spec. */
export interface LocatedMessage {
    path: string | null;
    message: string;
    rule?: string;
    severity?: 'problem' | 'warn' | 'info';
    fix?: string;
}
/** The field a message names, searching within its source part when marked. */
export declare function locateMessage(spec: unknown, message: string, loc?: SourceRef): string | null;
/** Why a figure could not be laid out, at its place and in the fields a spec has. */
export declare function layoutIssue(spec: unknown, error: unknown): SpecIssue;
/** Every text field that holds `char`. */
export declare function fieldsHolding(spec: unknown, char: string): string[];
/** The same limit on the messages of a drawn figure as on the issues of a spec. */
export declare function cappedMessages(list: LocatedMessage[]): LocatedMessage[];
/** A renderDiagram() verdict in the spec's terms: what failed (`problems`) and what was noticed (`findings`), each with its place. */
export declare function locateVerdict(spec: unknown, verdict: Verdict): {
    problems: LocatedMessage[];
    findings: LocatedMessage[];
};
/** What the checks found, as lines a model or a person can act on: `errors` fail `svg-diagram lint`, `advisories` are heuristics it only reports. */
export declare function lintMessages(c: RenderChecks): {
    errors: string[];
    advisories: string[];
};
export interface RenderSpecResult {
    /** false when the spec is invalid, or the figure failed verification or the checks on the drawing. */
    ok: boolean;
    /** Null when nothing could be drawn. When only the checks failed, this is the picture that was drawn. */
    svg: string | null;
    width: number;
    height: number;
    /** The spec could not be used or laid out, or the figure is too tall; nothing was returned to draw. */
    issues: SpecIssue[];
    /** What failed in the drawn figure. */
    problems: LocatedMessage[];
    /** Advice that does not fail the figure. */
    findings: LocatedMessage[];
}
/** The schema check alone (no part rules), for inputs that hold specs, such as a deck (lib/deck-spec.ts). */
export declare function validateAgainst(schema: JsonSchema, value: unknown, at?: string): SpecIssue[];
