import type { SourceRef } from './source-ref.ts';
import type { SpecIssue } from './spec-kit.ts';
import type { RenderChecks } from './svg-lint.ts';
import type { Verdict } from './types/verdicts.ts';
export declare const messageOf: (e: unknown) => string;
/**
 * The place of the text that `message` quotes, or null. Only quoted text counts: a word of the message itself ("Yes / No", "diagram.svg")
 * is not a mention. An exact match is taken first, then the start of a text (the checks shorten long ones), then a piece of it (a wrapped line).
 */
export declare function locateIn(v: unknown, at: string, message: string): string | null;
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
