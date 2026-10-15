export interface DeckState {index: number; total: number; grid: boolean; zoom: boolean}
export type DeckInput =
  | {type: 'next' | 'prev' | 'first' | 'last' | 'toggleGrid' | 'closeGrid' | 'toggleZoom'}
  | {type: 'goto' | 'select'; n: number};
export interface KeyEventLike {key: string; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean}
export interface KeyContext {typing?: boolean; interactive?: boolean; grid?: boolean}
export function initialState(total: number, index?: number): DeckState;
export function reduce(state: DeckState, input: DeckInput | null | undefined): DeckState;
export function parseHash(hash: string, names: readonly string[], total: number, current?: number): {index: number; grid: boolean};
export function formatHash(state: DeckState): string;
export function keyToInput(ev: KeyEventLike, ctx?: KeyContext): DeckInput | null;
