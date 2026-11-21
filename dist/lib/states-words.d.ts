export type StatesFlavor = 'flowchart' | undefined;
export interface StatesWords {
    who: string;
    diagram: string;
    node: string;
    edge: string;
    prefix: string;
}
export declare const statesWords: (flavor: StatesFlavor) => StatesWords;
