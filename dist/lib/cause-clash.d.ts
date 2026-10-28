export interface ClashEdge {
    from: string;
    to: string;
    points: {
        x: number;
        y: number;
    }[];
}
/** The pairs of arrows into an effect with an AND that cross or run together (each pair once, in the order the verifier reported them). A crossing elsewhere is left alone. */
export declare function andClashes<E extends ClashEdge>(edges: readonly E[], ands: readonly {
    to: string;
}[]): {
    a: E;
    b: E;
    how: 'crosses' | 'runs together with';
}[];
