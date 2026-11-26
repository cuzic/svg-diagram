import {outlineText} from './svg-outline.ts';
import {missingIssues, type TextEngine} from './spec-edge-core.ts';
import type {SpecIssue} from './spec-kit.ts';
import type {SlidePlan} from './pptx/package.ts';
import {zipEntries, type ZipEntry} from './pptx/zip.ts';

export interface FigurePlan {plan: SlidePlan; width: number; height: number; native: number; /** The checks the figure raised: `[rule-id] …` (what a deck's 'fill' compares, ADR 0060). */ findings: string[]; /** Its problems (what stops a build), as `message [rule-id]`; a deck stops at them. */ problems: string[]}

export interface PptxEdgeOptions {
  /** Draws a picture's SVG (text already outlined) as a PNG `scale` times its size. Required by the format as the fallback of every picture. */
  rasterize: (svg: string, scale: number) => Uint8Array | Promise<Uint8Array>;
  /** Typeface written into the text of the native shapes (default BIZ UDPGothic, which Windows has). */
  font?: string;
  /** PNG fallback scale (default 2). */
  pngScale?: number;
  maxHeight?: number;
}

export interface PptxEdgeResult {
  /** The .pptx file, or null when the spec could not be used or laid out. */
  pptx: Uint8Array | null;
  /** Why there is no file. */
  issues: SpecIssue[];
  /** How many bands became native shapes and how many pictures. */
  native: number;
  pictures: number;
}

export const noPptx = (issues: SpecIssue[]): PptxEdgeResult => ({pptx: null, issues, native: 0, pictures: 0});

/** Raw deflate where the runtime has CompressionStream (Workers, browsers, Node 18+); stored otherwise. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | undefined> {
  if (typeof CompressionStream === 'undefined') return undefined;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The entries zipped, the XML deflated where the runtime can (PNGs are stored: they are compressed already). */
export async function zipPackage(files: readonly {name: string; data: Uint8Array}[]): Promise<Uint8Array> {
  const entries: ZipEntry[] = [];
  for (const e of files) entries.push({...e, deflated: e.name.endsWith('.png') ? undefined : await deflateRaw(e.data)});
  return zipEntries(entries);
}

export function outlinePptxPictures(spec: unknown, plan: SlidePlan, engine: TextEngine): SpecIssue[] {
  // a picture's text as outlines, an emoji as text the viewer's emoji font draws; a character the font lacks is the spec's to fix, as in drawing
  const missing: {text: string; char: string}[] = [];
  const outline = (svg: string): string => { const o = outlineText(svg, engine.font, engine.textBox, {liveEmoji: true}); missing.push(...o.missing); return o.svg; };
  plan.pictures = plan.pictures.map(p => ({svg: outline(p.svg), pngSvg: outline(p.pngSvg)}));
  return missing.length ? missingIssues(spec, missing) : [];
}
