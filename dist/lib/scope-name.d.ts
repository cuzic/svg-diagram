/** The scope a band (input or laid out) was built with. */
export declare const scopeOf: (b: object) => string | undefined;
/** The registered name of an item: `scope.id`, or the bare id when the band has no scope. */
export declare const qualify: (scope: string | undefined, id: string) => string;
/** A scope is a plain name: it cannot hold the characters the reference syntax or a row column use (`:` `@` `#`), a dot or a blank. */
export declare function assertScope(scope: unknown, what: string): void;
