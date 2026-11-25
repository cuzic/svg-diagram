import type { SelectedPart } from './spec-selective.ts';
export declare const specPartLoaders: Readonly<Record<string, () => Promise<SelectedPart>>>;
/** Load definitions for the discriminants present in a structurally plausible JSON figure. */
export declare function loadSpecPartsFor(figure: unknown): Promise<SelectedPart[] | undefined>;
