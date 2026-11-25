import type { Json, JsonSchema, SpecIssue } from '../spec-kit.ts';
/** Events of a fault tree, `ref`s included, and how deep it goes below the top event. */
export declare const MAX_FTA_EVENTS = 30;
export declare const MAX_FTA_DEPTH = 5;
/** Factors and arrows of a relations diagram: its layout untangles crossings like a cause tree's. */
export declare const MAX_RELATION_NODES = 20;
export declare const MAX_RELATION_LINKS = 40;
/** Variables and links of a causal loop diagram, and the loops it may hold: every simple loop is found, named and drawn. Left to right,
 *  9 variables already leave their labels no room at the figure's width. */
export declare const MAX_CAUSAL_NODES = 8;
export declare const MAX_CAUSAL_LINKS = 14;
export declare const MAX_CAUSAL_LOOPS = 8;
/** Cards of an affinity diagram, in all its groups. */
export declare const MAX_AFFINITY_CARDS = 40;
/** Taken off a part before its options reach a builder: `lang` is what `en` adds, never the caller. */
export declare const english: (part: Json) => boolean;
export declare const optionsOf: (part: Json) => Json;
export declare const FTA_KIND: {
    type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
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
    description: string;
};
export declare const ftaEvent: (levels: number) => JsonSchema;
export declare function checkFta(e: Json, at: string, ids: Map<string, string>, refs: [string, string][], count: {
    n: number;
}, depth: number, issues: SpecIssue[]): void;
/** The words a fault tree writes by itself, in English. */
export declare const FTA_EN: {
    singlePoint: string;
    undevelopedAlone: string;
    houseTrue: string;
    houseFalse: string;
    period: string;
    topP: string;
    topBound: string;
    assumption: string;
};
export declare function loopCount(nodes: readonly string[], links: readonly Json[], limit: number): number;
export declare const POLARITY: {
    type?: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean';
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
    description: string;
};
export declare const affinityGroup: (levels: number) => JsonSchema;
export declare const cardsIn: (g: Json) => number;
export declare function checkAffinity(g: Json, at: string, issues: SpecIssue[]): void;
export declare const FMEA_EN: {
    item: string;
    mode: string;
    effect: string;
    cause: string;
    action: string;
    s: string;
    o: string;
    d: string;
    rpn: string;
    afterS: string;
    afterO: string;
    afterD: string;
    afterRpn: string;
};
export declare const IS_IS_NOT_EN: {
    dim: string;
    is: string;
    isNot: string;
    distinct: string;
    change: string;
};
export declare const DIM_EN: Record<string, string>;
export declare const MATRIX_EN: Record<string, string>;
