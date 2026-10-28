import type { CanvasLayout, GridBand } from './types/containers.ts';
import type { EmphasisTone } from './types/core.ts';
interface Region {
    id: string;
    title: string;
    col: number;
    row: number;
    cs?: number;
    rs?: number;
    /** Not counted by requireAll (a header cell that may stay a bare label, a free-form extra). */
    optional?: boolean;
    /** A pill on the box's top edge: says in words what a tone only hints (内部環境 / ハード). */
    tag?: string;
    tone?: EmphasisTone;
}
export declare const TEMPLATES: {
    readonly bmc: {
        readonly cols: readonly [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        readonly rows: readonly [1, 1, 0.8];
        readonly aspect: 0.62;
        readonly regions: (Region & {
            id: "activities" | "channels" | "cost" | "partners" | "relationships" | "resources" | "revenue" | "segments" | "value";
        })[];
    };
    readonly lean: {
        readonly cols: readonly [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        readonly rows: readonly [1, 1, 0.8];
        readonly aspect: 0.62;
        readonly regions: (Region & {
            id: "channels" | "cost" | "metrics" | "problem" | "revenue" | "segments" | "solution" | "unfair" | "uvp";
        })[];
    };
    readonly vpc: {
        readonly cols: readonly [1, 1];
        readonly rows: readonly [0.45, 1, 1, 1];
        readonly aspect: 0.7;
        readonly gap: 12;
        readonly labels: readonly [Region & {
            id: "";
        }, Region & {
            id: "";
        }];
        readonly regions: readonly [Region & {
            id: "gainCreators";
        }, Region & {
            id: "gains";
        }, Region & {
            id: "products";
        }, Region & {
            id: "jobs";
        }, Region & {
            id: "painRelievers";
        }, Region & {
            id: "pains";
        }];
    };
    readonly swot: {
        readonly cols: readonly [1, 1];
        readonly rows: readonly [1, 1];
        readonly aspect: 0.5;
        readonly regions: readonly [Region & {
            id: "strengths";
        }, Region & {
            id: "weaknesses";
        }, Region & {
            id: "opportunities";
        }, Region & {
            id: "threats";
        }];
    };
    readonly tows: {
        readonly cols: readonly [0.8, 1.6, 1.6];
        readonly rows: readonly [0.7, 1.2, 1.2];
        readonly aspect: 0.62;
        readonly regions: readonly [Region & {
            id: "strengths";
        }, Region & {
            id: "weaknesses";
        }, Region & {
            id: "opportunities";
        }, Region & {
            id: "threats";
        }, Region & {
            id: "so";
        }, Region & {
            id: "wo";
        }, Region & {
            id: "st";
        }, Region & {
            id: "wt";
        }];
    };
    readonly errc: {
        readonly cols: readonly [1, 1];
        readonly rows: readonly [1, 1];
        readonly aspect: 0.5;
        readonly regions: readonly [Region & {
            id: "eliminate";
        }, Region & {
            id: "raise";
        }, Region & {
            id: "reduce";
        }, Region & {
            id: "create";
        }];
    };
    readonly pest: {
        readonly cols: readonly [1, 1];
        readonly rows: readonly [1, 1];
        readonly aspect: 0.5;
        readonly regions: readonly [Region & {
            id: "political";
        }, Region & {
            id: "economic";
        }, Region & {
            id: "social";
        }, Region & {
            id: "technological";
        }];
    };
    readonly threeC: {
        readonly cols: readonly [1, 1, 1];
        readonly rows: readonly [1, 0.5];
        readonly aspect: 0.5;
        readonly regions: readonly [Region & {
            id: "customer";
        }, Region & {
            id: "competitor";
        }, Region & {
            id: "company";
        }, Region & {
            id: "insight";
        }];
    };
    readonly sevenS: {
        readonly cols: readonly [1, 1, 1, 1];
        readonly rows: readonly [1, 1.1, 1];
        readonly aspect: 0.8;
        readonly gap: 12;
        readonly regions: readonly [Region & {
            id: "strategy";
        }, Region & {
            id: "structure";
        }, Region & {
            id: "style";
        }, Region & {
            id: "values";
        }, Region & {
            id: "systems";
        }, Region & {
            id: "staff";
        }, Region & {
            id: "skills";
        }];
    };
    readonly fiveForces: {
        readonly cols: readonly [1, 1.2, 1];
        readonly rows: readonly [1, 1.1, 1];
        readonly aspect: 0.7;
        readonly gap: 16;
        readonly regions: readonly [Region & {
            id: "newEntrants";
        }, Region & {
            id: "suppliers";
        }, Region & {
            id: "rivalry";
        }, Region & {
            id: "buyers";
        }, Region & {
            id: "substitutes";
        }];
    };
    readonly empathy: {
        readonly cols: readonly [1, 1, 1, 1, 1, 1];
        readonly rows: readonly [1, 1.3, 1, 1.1];
        readonly aspect: 0.85;
        readonly regions: readonly [Region & {
            id: "thinks";
        }, Region & {
            id: "says";
        }, Region & {
            id: "person";
        }, Region & {
            id: "does";
        }, Region & {
            id: "feels";
        }, Region & {
            id: "pains";
        }, Region & {
            id: "gains";
        }];
    };
    readonly persona: {
        readonly cols: readonly [1, 1, 1, 1, 1, 1];
        readonly rows: readonly [1, 1.2, 1];
        readonly aspect: 0.6;
        readonly regions: readonly [Region & {
            id: "profile";
        }, Region & {
            id: "quote";
        }, Region & {
            id: "goals";
        }, Region & {
            id: "frustrations";
        }, Region & {
            id: "behaviors";
        }, Region & {
            id: "needs";
        }];
    };
    readonly a3: {
        readonly cols: readonly [1, 1];
        readonly rows: readonly [1, 1, 1, 1];
        readonly aspect: 0.9;
        readonly regions: readonly [Region & {
            id: "background";
        }, Region & {
            id: "current";
        }, Region & {
            id: "goal";
        }, Region & {
            id: "cause";
        }, Region & {
            id: "countermeasures";
        }, Region & {
            id: "plan";
        }, Region & {
            id: "followup";
        }];
    };
};
export type CanvasTemplate = keyof typeof TEMPLATES;
type PestleKeys = 'legal' | 'environmental';
/** The region ids of a template (the keys of its content). */
export type CanvasKey<T extends CanvasTemplate> = (typeof TEMPLATES)[T]['regions'][number]['id'] | (T extends 'pest' ? PestleKeys : never);
export type CanvasContent<T extends CanvasTemplate> = {
    [K in CanvasKey<T>]?: string | readonly string[];
};
export interface CanvasOpts<T extends CanvasTemplate = CanvasTemplate> {
    /** A caption above the canvas. */
    title?: string;
    /** Region titles, where the Japanese default does not fit your subject. */
    titles?: {
        [K in CanvasKey<T>]?: string;
    };
    /** A tone per region. */
    tone?: {
        [K in CanvasKey<T>]?: EmphasisTone;
    };
    /** Regions to stress: drawn as tone 'accent' with a 重点 pill (the word says it, not just the colour). */
    emphasis?: readonly CanvasKey<T>[];
    /** A chip at the bottom-right corner of the canvas (架空の例 / 仮説). */
    stamp?: string;
    /** The regions (not the title above them) are at least this tall (px). Content that needs more throws (shorten it or leave `h` out: without it the canvas grows). */
    h?: number;
    /** How tall the canvas is. 'content' (default): each row is as tall as its regions need (at least 96px for a region that is meant to be filled), so no region carries a blank
     *  band under its text. 'aspect': the canvas keeps the template's height / width as a floor (the old look: a roomy form to write into). `h` works with both. */
    fit?: 'content' | 'aspect';
    /** Gap between the regions (px, rounded to a multiple of 4; the rows under a tagged region keep at least 16px). */
    gap?: number;
    /** Every region needs content: a missing one is reported as canvas-region-empty. */
    requireAll?: boolean;
    /** pest only: add 法律 (Legal) and 環境 (Environment): PESTLE. Also on when `legal` or `environmental` has content. */
    pestle?: T extends 'pest' ? boolean : never;
    /** Click stage per region (see diagram({reveal})): {value: 1, segments: 2}. */
    reveal?: {
        [K in CanvasKey<T>]?: number;
    };
    /** An anchor id: each region is then `${id}-${region}` for connect(), reveal and spotlight. */
    id?: string;
}
export declare const canvasKeys: (template: CanvasTemplate, pestle?: boolean) => string[];
export declare const canvasTemplates: () => string[];
/** CanvasOpts with the region ids as plain strings: what canvasBand() validates. */
export type LooseCanvasOpts = Omit<CanvasOpts, 'titles' | 'tone' | 'reveal' | 'emphasis' | 'pestle'> & {
    pestle?: boolean;
    titles?: Record<string, string | undefined>;
    tone?: Record<string, EmphasisTone | undefined>;
    reveal?: Record<string, number | undefined>;
    emphasis?: readonly string[];
};
/** The grid() a canvas is: one box per region, in the template's order, with its cell. */
export declare function canvasBand(template: string, content: Record<string, string | readonly string[] | undefined>, opts?: LooseCanvasOpts): GridBand;
/** The least height of a region that is meant to be filled (fit 'content'): a row never collapses to its title and one line. Label cells and optional regions left empty have no floor. */
export declare const CANVAS_MIN_ROW_H = 96;
/**
 * The x and width of every column of a canvas `cw` wide whose left edge is `x0`. Column starts are on the 4px grid the emitter snaps
 * shapes to (gap is a multiple of 4), so the gutters are all `gap` wide and a region spanning columns lines up with the ones it spans.
 */
export declare function canvasColumns(c: CanvasLayout, x0: number, cw: number, gap: number): {
    x: number[];
    w: number[];
};
/** The left edge and width of the cell `p` covers. */
export declare function canvasSpan(cols: {
    x: number[];
    w: number[];
}, p: {
    col: number;
    cs: number;
}): {
    x: number;
    w: number;
};
/**
 * The height of every row, from what each cell needs: a row is as tall as its tallest single-row cell; a cell spanning rows that needs more
 * than they give widens them equally; and the whole is at least `minTotal`, shared by the rows' weights (a row that needs more keeps it).
 */
export declare function canvasRowHeights(c: CanvasLayout, needs: readonly number[], gap: number, minTotal: number): number[];
export {};
