import type { WebMeasurer, WebRender } from '../web.ts';
import type { CharacterManifest, ComicAspect, ComicFinding, ComicGeometry, ComicWorksheet, Values } from '../types/comic.ts';
export type ComicRender = WebRender & {
    findings: ComicFinding[];
    geometry: ComicGeometry;
    thumbnail(panelId: string | undefined, opts: {
        width: number;
    }): string;
};
export declare function replaceComicFragment(svg: string, original: string, filled: string): string;
export declare function renderComic(sheet: ComicWorksheet, opts: {
    measure: WebMeasurer;
    values?: Values;
    characters?: Record<string, CharacterManifest>;
    aspect?: ComicAspect;
    nodeIds?: boolean;
}): Promise<ComicRender>;
