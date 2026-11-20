import { type RenderedDeck } from './render-deck.ts';
export interface RenderRequest {
    deckFile: string;
    fresh: boolean;
}
export interface RenderReply {
    deck: RenderedDeck | null;
    errors: string[];
    files: string[];
}
