import type { Json, JsonSchema, PartDef, SpecIssue } from './spec-kit.ts';
export declare const join: (at: string, key: string) => string;
export declare function countEmoji(v: unknown): number;
export declare function totalText(v: unknown): number;
/** The ids that become anchors of the figure, against each other across parts (a repeat inside a part is reported by that part). */
export declare function checkAnchors(parts: readonly Json[], issues: SpecIssue[], partOf: (type: unknown) => PartDef | undefined): void;
export declare const capped: (issues: SpecIssue[]) => SpecIssue[];
/** The schema check alone (no part rules), for inputs that hold specs, such as a deck (lib/deck-spec.ts). */
export declare function validateAgainst(schema: JsonSchema, value: unknown, at?: string): SpecIssue[];
