export interface IconSet {
    description: string;
    icons: Record<string, string>;
}
export declare const ICON_SETS: Record<string, IconSet>;
/** The `set:icon=name` arguments `icons add` takes. */
export declare function setArgs(name: string): string[];
