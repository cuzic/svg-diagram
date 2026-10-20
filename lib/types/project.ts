// Types: project config, svg diff, documents.
import type {ToneOverrides} from '../tokens.ts';
import type {FontFamily, NotationKey, RuleId} from './core.ts';

/** .svg-diagram.json (+ `_file`, the path it was read from). */
export interface Config {
  accept?: Partial<Record<RuleId, string>>;
  maxWidth?: number;
  /** Glossary for every diagram: {"ユーザー": ["利用者", "ユザー"]} — the word to use and the spellings `check` reports as `term-avoid`. */
  terms?: Record<string, string[]>;
  /** The default for every diagram's `legend` (a diagram's own wins): false = no legend needed, 'auto' = add the missing entries. */
  legend?: 'auto' | false;
  /** Legend wording for every diagram, e.g. {"tone:accent": "注意"} (a diagram's own legendLabels win per key). */
  legendLabels?: Partial<Record<NotationKey, string>>;
  /** Tone colours for every diagram, e.g. {"accent": {"fill": "#e6d3bd", "dark": {"fill": "#4a3a28"}}} (a diagram's own `tones` win per colour). */
  tones?: ToneOverrides;
  /** The default for every diagram's `wrap` (a diagram's own wins): 'phrase' | 'char' | 'bunsetsu' | 'bunsetsu-soft'. */
  wrap?: 'phrase' | 'char' | 'bunsetsu' | 'bunsetsu-soft';
  /** The default for every diagram's `keepWords` (a diagram's own wins): never break a katakana word across lines. */
  keepWords?: boolean;
  /** How text is measured: 'font' (default) from the font files, no browser (see `fonts`); 'chromium' in a headless browser. */
  measure?: 'chromium' | 'font';
  /** Font files to measure with when `measure` is 'font': per family, the regular and the bold (weight >= 600) one, as `path` or `path#faceIndex`. Unset: found with fontconfig. */
  fonts?: FontSpecs;
  /** The lowest `canvas.minText` a diagram may declare (10 to 14, default 14). A canvas diagram below it throws; a figure still has to declare its own `minText`. */
  fontFloor?: number;
  /** Where `build` writes the SVGs when neither --out nor --out-dir is given (default "svg"), and where `lint` / `check --drift` look for them. Relative to this file's folder. */
  outDir?: string;
  /** The day for gantt({today: 'auto'}) when no --today / SVG_DIAGRAM_TODAY is given: 'YYYY-MM-DD'. */
  today?: string;
  /** Set by the CLIs from --today (never read from the file): wins over the environment and "today". */
  _today?: string;
  _file?: string;
}
export type FontSpecs = Partial<Record<FontFamily, {regular?: string; bold?: string}>>;
export interface ChangeExplanation {identical: boolean; visual: boolean; lines: string[]}
/** One numbered item of a Markdown page's notes list. */
export interface DocNoteItem {n: number; title: string; text: string}
/** One `![alt](x.svg)` found in a Markdown page, with the numbered list after it. */
export interface DocImage {line: number; alt: string; ref: string; items: DocNoteItem[]; caption?: DocCaption}
/** A 「図N-M」 caption tied to a figure: in its alt text, or on the line just before/after it. */
export interface DocCaption {ch: number; no: number; line: number}
