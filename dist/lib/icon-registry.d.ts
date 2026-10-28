import type { IconGlyph, IconManifest } from './icon-store.ts';
import type { IconName } from './icons.ts';
/** Path of the manifest that applies from `from`, or undefined. */
export declare function findManifest(from?: string | undefined): string | undefined;
/** The installed glyph for a name, or undefined. */
export declare function glyphOf(name: string): IconGlyph | undefined;
export declare const icon: {
    emoji(name: import("./icons.ts").EmojiName): string;
    emojiNames: import("./icons.ts").EmojiName[];
    /** Which sets have this name: `path` for box({icon}) / iconRow() (installed in the project), `emoji` for icon.emoji(). */
    has(name: string): {
        path: boolean;
        emoji: boolean;
    };
    pathNames: IconName[];
    /** Use this manifest (an object, or the text of a svg-diagram.icons.json) instead of looking for the file. `undefined` goes back to the file. */
    use(manifest: IconManifest | string | undefined): void;
};
/** box({icon}) / iconRow(): the installed glyph, or a throw that says how to install it. */
export declare function resolveIcon(name: string, caller: string): IconGlyph;
