export type ChartIds<S extends readonly {
    id?: string;
}[]> = Extract<S[number]['id'], string>;
