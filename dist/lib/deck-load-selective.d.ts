import { type LoadDeckResult } from './deck-file.ts';
/** Resolve a deck and load only the definitions used by each valid JSON figure. */
export declare function loadDeckSelective(deckFile: string): Promise<LoadDeckResult>;
