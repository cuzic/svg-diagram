export declare const SPEC_VERSION = 1;
/**
 * The range of a spec's canvas (ADR 0057 D2): from the default slide (1280 wide) up to 4K, and text from the default font floor (a spec
 * cannot lower it: renderSpec keeps fontFloor 14) up to the default slide's 24px. Every example of partCatalog() draws without a problem
 * anywhere in it (test/spec.test.ts). Past it the text outgrows layouts whose sizes do not scale with it yet (a loop-back's route, a
 * causal loop's delay mark), and a canvas narrower than a document figure (940) leaves the wider parts no room.
 */
export declare const CANVAS_LIMITS: {
    readonly width: readonly [1280, 3840];
    readonly height: readonly [360, 2160];
    readonly minText: readonly [14, 24];
};
/** All the text of a spec together, in characters. The per-field limits alone would allow a figure that takes seconds to lay out. */
export declare const MAX_TOTAL_TEXT = 6000;
/** Emoji in a whole spec. They cost far more to draw than other characters: a colour glyph is a picture, and a few hundred take many seconds. */
export declare const MAX_EMOJI = 30;
/** The columns a swimlane has room for at the figure's width. */
export declare const MAX_SWIMLANE_COLS = 8;
/** Levels under the root of a mind map, and nodes in the whole map. */
export declare const MAX_TREE_DEPTH = 4;
export declare const MAX_TREE_NODES = 60;
/** Entities and links of a cause tree. Untangling the arrows of an AND searches orders of the whole figure: at 40 entities that took 4.5 s of CPU on a worker (ADR 0053). */
export declare const MAX_CAUSE_NODES = 30;
export declare const MAX_CAUSE_LINKS = 45;
/** Issues reported at once: enough to work on, and a bad spec cannot make the answer huge. */
export declare const MAX_ISSUES = 20;
/** The figure's own width a spec may give (ADR 0059): narrower than the document's 940 only (a wider figure is a `canvas`, ADR 0057). */
export declare const SPEC_WIDTH: {
    readonly min: 320;
    readonly max: 940;
};
export declare const MAX_QUOTED = 80;
/** The subset of JSON Schema this file writes and validates. */
export interface JsonSchema {
    type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
    description?: string;
    const?: string | number;
    enum?: readonly (string | number | boolean)[];
    properties?: Readonly<Record<string, JsonSchema>>;
    required?: readonly string[];
    additionalProperties?: false;
    items?: JsonSchema;
    oneOf?: readonly JsonSchema[];
    minItems?: number;
    maxItems?: number;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
}
/** What is wrong and where: `path` is written like `parts[0].nodes[2].label` ('' is the whole spec). */
export interface SpecIssue {
    path: string;
    message: string;
}
export declare class SpecError extends Error {
    readonly issues: readonly SpecIssue[];
    constructor(issues: readonly SpecIssue[]);
}
/**
 * A file's JSON without the `$schema` an editor reads (ADR 0071): a spec, a figure file and a deck may start with it, and the checks
 * never see it. Only a string is taken out: anything else is left for the checks to report as an unknown field, as site.json does.
 */
export declare const withoutSchemaField: (v: unknown) => unknown;
export type Json = Record<string, unknown>;
export type Check = (part: Json, at: string, issues: SpecIssue[]) => void;
export declare const text: (description: string, maxLength?: number) => JsonSchema;
export declare const id: (description: string) => JsonSchema;
export declare const object: (properties: Record<string, JsonSchema>, required: readonly string[], description?: string) => JsonSchema;
export declare const list: (items: JsonSchema, maxItems: number, minItems?: number) => JsonSchema;
export declare const oneOf: (...values: readonly string[]) => JsonSchema;
export declare const count: (description: string, maximum: number) => JsonSchema;
export declare const BOX_TONE: JsonSchema;
export declare const TEXT_TONE: JsonSchema;
export declare const LINE: JsonSchema;
export declare const EMPHASIS_TONE: JsonSchema;
export declare const MAX_NODE_WIDTH: JsonSchema;
export declare const ARROW: JsonSchema;
export declare const items: (part: Json, key: string) => Json[];
/** Every `key` of `part[list]` once; a repeat is reported. Returns the set. */
export declare function uniqueIds(part: Json, listKey: string, at: string, issues: SpecIssue[], key?: string): Set<string>;
export declare function mustExist(value: unknown, known: ReadonlySet<string>, path: string, what: string, issues: SpecIssue[]): void;
/** A swimlane flow end: 'id', 'id:side' or 'id:side@t' with t from 0 to 1. Anything else would reach the layout as a coordinate that is not a number. */
export declare const FLOW_END: RegExp;
export declare function checkFlowEnd(ref: unknown, steps: ReadonlySet<string>, path: string, issues: SpecIssue[]): void;
export interface PartDef {
    type: string;
    description: string;
    schema: JsonSchema;
    example: Json;
    check: Check;
    build: (part: Json, at: string) => unknown;
    /**
     * The ids that become anchors of the whole figure, so they must not repeat between parts: the list whose items' ids they are, or a
     * function that gathers them with their places (a part whose ids are nested, such as board's groups).
     */
    anchors?: string | ((part: Json, at: string) => {
        id: string;
        path: string;
    }[]);
    /** Options the part takes when the spec says `lang: 'en'` and the part does not give them. */
    en?: Json;
    /** English for the words this part puts in the legend (keys as in LEGEND_EN), for `lang: 'en'`. */
    legendEn?: Readonly<Record<string, string>>;
}
export declare const withoutType: ({ type: _type, ...rest }: Json) => Json;
/** The words the figures write by themselves (legends, headings), for `lang: 'en'`. Japanese is the default of svg-diagram. */
export declare const LEGEND_EN: Record<string, string>;
/** The options a part takes in English when the spec says `lang: 'en'` and the part does not give them. */
export declare const PART_EN: Record<string, Json>;
export declare const treeItem: (levels: number) => JsonSchema;
export declare const flowSteps: (min: number, max: number) => JsonSchema;
export declare const pair: (items: JsonSchema, description: string) => JsonSchema;
export declare const axis: (description: string) => JsonSchema;
export declare const QUADRANT_GRID = 4;
export declare const DATE: JsonSchema;
/** A real day written YYYY-MM-DD. */
export declare const isDay: (v: unknown) => boolean;
export declare const dayOf: (v: string) => number;
export declare const whyNode: (levels: number) => JsonSchema;
export declare const whySize: (n: Json) => number;
export declare const CELL: JsonSchema;
export declare const treeSize: (item: Json) => number;
/** A number as a chart takes it: finite, and not so large that the axis arithmetic loses it. */
export declare const NUM: JsonSchema;
/** A number that is never below 0, such as a count or an amount. */
export declare const AMOUNT: JsonSchema;
/** The tone of a chart mark. */
export declare const CHART_TONE: JsonSchema;
/** Every list in `lists` of `part` has as many entries as `n`, reported at the list. */
export declare function sameLength(part: Json, at: string, n: number, what: string, issues: SpecIssue[], ...paths: readonly (readonly (string | number)[])[]): void;
/** A step / ring / sector named by its 1-based number or its label (or id) (ADR 0065). */
export declare const STEP_REF: (description: string) => JsonSchema;
/** An issue where `v` is neither a number within `n` nor the label or id of one of `xs`, or is the label or id of two of them (ADR 0065). */
export declare function refIssue(v: unknown, n: number, xs: readonly Json[], path: string, what: string, issues: SpecIssue[]): void;
