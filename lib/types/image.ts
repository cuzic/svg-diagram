// Types: image.
import type {Anchor, Dimmed, EmphasisTone, LabelRole, Rect, RevealOpts, ScopeOpts} from './core.ts';
import type {Band} from './index.ts';

/** A position as fractions of the picture: [0, 0] is its top-left corner, [1, 1] its bottom-right. */
export type ImagePoint = readonly [x: number, y: number];
/** A region as fractions of the picture: [x, y, w, h]. */
export type ImageRect = readonly [x: number, y: number, w: number, h: number];
/** An outline round a region of the picture. Its `id` is a spotlight target and a connect() endpoint. */
export interface ImageMark {
  /** Unique across the diagram, like every anchor id. */
  id?: string;
  rect: ImageRect;
  /** The outline's colour (and the label plate's tone). Default 'accent'. */
  tone?: EmphasisTone;
  /** A word on a plate at the outline's top-left corner. */
  label?: string;
  /** The label's text size (a role: 'note' 14px, 'banner' 16px, 'stat' 34px). Default: the picture's `labelRole`. The plate grows with it. */
  role?: LabelRole;
  /** Never earlier than the picture's own reveal (the later of the two); `until` likewise never later than the picture's. */
  reveal?: number;
  until?: number;
}
/** A word on an opaque plate at a point of the picture. There is no way to put text on the bare picture: its pixels are not known to the contrast check. */
export interface ImageLabel {
  text: string;
  at: ImagePoint;
  /** Which end of the plate sits on `at`. Default 'start'. */
  anchor?: 'start' | 'middle' | 'end';
  /** The plate's tone (its fill, outline and text). Default 'plain' (white plate, dark text). */
  tone?: EmphasisTone;
  /** The text size (a role: 'note' 14px, 'banner' 16px, 'stat' 34px). Default: the picture's `labelRole`. The plate grows with it. */
  role?: LabelRole;
  reveal?: number;
  until?: number;
}
export interface ImageOpts extends RevealOpts, ScopeOpts {
  /** A spotlight target and a connect() endpoint (the whole picture). May not repeat a mark's id. */
  id?: string;
  /** What the picture shows, for readers who cannot see it (the SVG's <desc> and the <image>'s label). Required: pass `decorative: true` instead when it adds nothing. */
  alt?: string;
  decorative?: boolean;
  /** The picture's width in px (at most the content width; default: the content width). Its height follows the file's aspect ratio. Not together with `height`. */
  width?: number;
  /** The picture's height in px (the width follows the aspect ratio, and is capped at the content width). Not together with `width`. */
  height?: number;
  /** Where a picture narrower than the content sits. Default 'center'. */
  align?: 'left' | 'center' | 'right';
  /** The text size of every label plate that has no `role` of its own. Default 'note' (14px). */
  labelRole?: LabelRole;
  marks?: readonly ImageMark[];
  labels?: readonly ImageLabel[];
  /**
   * Parts laid over the picture, stacked from its top like the children of a group(): the picture is their backdrop. Their text must
   * be checkable: a box / banner is (opaque), a caption or a group title is bare text on the picture and fails the post-render lint.
   * connect() stays a top-level band; it may point at their ids. They must fit in the picture's height (verify says by how much they do not).
   */
  over?: Band | readonly Band[];
  /** Space between the picture's edge and `over` (default 16). */
  pad?: number;
}
export interface ImageBand {
  type: 'image';
  id?: string;
  /** The file as a `data:` URI (read once, by image()). */
  href: string;
  naturalW: number;
  naturalH: number;
  bytes: number;
  alt: string;
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
  labelRole?: LabelRole;
  marks?: ImageMark[];
  labels?: ImageLabel[];
  /** The `over` parts (named like a group's so the walkers that follow `children` see them). */
  children?: Band[];
  pad?: number;
  reveal?: number;
  until?: number;
}
/** A mark placed (px); `dim` is set by spotlight. */
export interface LaidOutImageMark extends Rect, Dimmed {id?: string; tone: EmphasisTone; reveal?: number; until?: number}
/** A label plate placed (px). `mark`: index of the mark it belongs to. */
export interface LaidOutImagePlate extends Rect, Dimmed {text: string; size: number; tone: EmphasisTone; reveal?: number; until?: number; mark?: number}
export interface LaidOutImage extends Rect, Dimmed {
  type: 'image';
  id?: string;
  href: string;
  alt: string;
  bytes: number;
  reveal?: number;
  until?: number;
  marks: LaidOutImageMark[];
  plates: LaidOutImagePlate[];
  anchors: Anchor[];
  /** Parts are laid over this picture: it is their backdrop, so the overlap and connector checks leave it out. */
  backdrop?: boolean;
  /** Set by spotlight: regions of the picture that stay clear while the rest is veiled (a focused mark). */
  holes?: Rect[];
}
