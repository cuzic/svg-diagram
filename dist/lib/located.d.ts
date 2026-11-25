import type { DefinitionOf } from './band-children.ts';
/**
 * Capture the call to a public builder while preserving its overloads and properties. `definitionOf` (default: the definition a band carries) finds the definition of a part that
 * carries none yet (the all-in-one builders make plain data: located-full.ts), so the parts nested in it are marked too.
 */
export declare function located<F>(fn: F, definitionOf?: DefinitionOf): F;
/** For a composer that builds plain data (no definitions): a band that holds bands in `children` is walked through them. */
export declare const holdsChildren: DefinitionOf;
