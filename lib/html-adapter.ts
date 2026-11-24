import type {ToneEnv} from './tokens.ts';
import type {Theme, Roles} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';

export const px = (n: number): string => `${+n.toFixed(2)}px`;

/** The ascent and descent of the primary font at a size: given by the shell (lib/font-box.ts), which reads the font files. */
export type FontBox = (size: number, weight: number, mono: boolean) => {ascent: number; descent: number};

export interface HtmlBandAdapter<T extends LaidOutBand['type'] = LaidOutBand['type']> {
  readonly type: T;
  accepts(band: Extract<LaidOutBand, {type: T}>): boolean;
  render(band: Extract<LaidOutBand, {type: T}>, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles, stage?: number): string;
}

export type HtmlAdapters = {[T in LaidOutBand['type']]?: HtmlBandAdapter<T>};

export function htmlAdapterFor(adapters: HtmlAdapters, band: LaidOutBand): HtmlBandAdapter | undefined {
  // The lookup key couples each renderer's input type to the current band.
  const adapter = adapters[band.type];
  return adapter?.type === band.type ? adapter as HtmlBandAdapter : undefined;
}

// like SVG text, runs of white space are one space (XML white space only: U+3000 and NBSP are characters, not white space)
const collapse = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ');
export const escapeHtmlText = (s: string): string => collapse(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string);
