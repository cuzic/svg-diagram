import { type JsonSchema } from './spec.ts';
/** A JSON Schema as written to a file: the subset lib/spec-kit.ts checks with, and the few keywords only the files use. */
export type SchemaNode = JsonSchema | {
    [key: string]: unknown;
};
/** Keywords only VS Code reads (completion and messages); a standard validator is told to ignore them. */
export declare const EDITOR_KEYWORDS: readonly ['enumDescriptions', 'defaultSnippets', 'patternErrorMessage'];
/** Each file in schema/, by name. */
export declare function schemaFiles(): Record<string, SchemaNode>;
/** A file's text as written to schema/. */
export declare const schemaText: (schema: SchemaNode) => string;
