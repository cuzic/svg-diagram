import type { Json, JsonSchema, SpecIssue } from '../spec-kit.ts';
/** Nodes and arrows of the graph figures below. Their layouts search orders of the whole graph: these keep the worst allowed input near 2 s on a worker. */
export declare const MAX_BPMN_NODES = 30;
export declare const MAX_BPMN_FLOWS = 40;
export declare const MAX_CLASSES = 15;
export declare const MAX_CLASS_RELATIONS = 24;
export declare const MAX_PERT_TASKS = 20;
export declare const MAX_DEPENDENCY_NODES = 20;
export declare const MAX_DEPENDENCY_EDGES = 32;
/** A hidden marker the English defaults carry into build(): a few parts compute words of their own. */
export declare const EN_MARK = "_lang";
export declare const english: (part: Json) => boolean;
export declare const withoutMarks: (part: Json) => Json;
/** The ids of `part[listKey]` that a path of `edgeKey` items names, checked at their places. */
export declare function checkEnds(part: Json, at: string, listKey: string, known: ReadonlySet<string>, what: string, issues: SpecIssue[], keys?: readonly string[]): void;
/** The first cycle through `edges` (as ids, the first repeated at the end), or null. */
export declare function cycleOf(ids: readonly string[], edges: readonly (readonly [string, string])[]): string[] | null;
export declare const TL_DATE: JsonSchema;
export declare const TL_END: JsonSchema;
export declare const TL_TONE: JsonSchema;
export declare const DAY_MS = 86400000;
/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' as days, or null when it is not a real date. */
export declare function tlDay(v: unknown): number | null;
/** The English of the span the figure writes from now to the deadline ("1 year 3 months left"), counted the way lib/timeline.ts counts. */
export declare function remainingEn(from: string, to: string): string;
export declare const DATE_KEYS: readonly ['now', 'deadline', 'marks', 'span', 'remaining'];
export declare const NUMBER_KEYS: readonly ['unit', 'step', 'lanes', 'events', 'spans'];
export declare function checkTimeline(part: Json, at: string, issues: SpecIssue[]): void;
