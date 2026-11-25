import type { ToneEnv } from './tokens.ts';
import type { ImageBand, LaidOutImage } from './types/image.ts';
import type { Appearance, Theme } from './types/core.ts';
import type { CheckRect, Finding } from './types/verdicts.ts';
export declare function imageProblems(band: LaidOutImage): string[];
export declare function imageContrast(band: LaidOutImage, day: Theme, appearance: Appearance | undefined, tones: ToneEnv): string[];
export declare const imageRects: (band: LaidOutImage) => CheckRect[];
export declare function imageSizeFindings(band: ImageBand): Finding[];
export declare const imageRules: Readonly<{
    readonly 'image-large': {
        readonly doc: '埋め込んだ画像が大きい（300 KB 超）。ファイルがそのまま SVG に入り、段階表示の各ファイルにも入る。縮小・圧縮してから使う';
        readonly scope: 'band';
    };
}>;
