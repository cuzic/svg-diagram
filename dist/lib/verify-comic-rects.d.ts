import type { Rect } from './types/core.ts';
import type { ComicLaidBubble, LaidOutComic } from './types/comic.ts';
import type { CheckRect } from './types/verdicts.ts';
export declare function comicSlotOwners(band: LaidOutComic): Map<string, ComicLaidBubble>;
export declare function comicRects(band: LaidOutComic): CheckRect[];
type ComicConnect = {
    readonly fromId: string;
    readonly toId: string;
    readonly fromLabel?: string;
    readonly toLabel?: string;
    readonly segments: readonly Readonly<Rect>[];
};
export declare function comicConnectorProblems(band: LaidOutComic, connects: readonly ComicConnect[]): string[];
export {};
