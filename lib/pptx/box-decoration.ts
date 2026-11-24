import type {Ctx} from './adapter.ts';
import {linesText, namedAs} from './prims.ts';
import {boxXml, plainBox} from './shapes.ts';
import type {TextBox} from './shapes.ts';
import type {Rect} from './xml.ts';

/** A box's text, its lines joined: what it is named by (ADR 0054 D7). */
export const textOf = (b: TextBox): string => linesText((b.wrappedRuns ?? []).flatMap(r => r.lines));

/** Font size of the small badges (tag, stamp, step) a box carries beside its main shape. */
const badgeSize = (r: Rect): number => Math.min(12, Math.max(8, r.h * 0.48));

export function boxBadge(ctx: Ctx, tone: TextBox['tone'], text: string, rect: Rect, name: string): string {
  return boxXml(ctx.next(), name, plainBox(rect, text, {
    size: badgeSize(rect), weight: 700, tone, frame: true, padX: 2, padY: 1,
  }), ctx.ld.day, ctx.tones, ctx.fonts);
}

export function stampBadge(ctx: Ctx, box: Rect & {stampW?: number; tone?: TextBox['tone']}, stamp: string): string {
  const width = box.stampW ?? 64;
  return boxBadge(ctx, box.tone, stamp, {
    x: box.x + box.w - width - 8, y: box.y + box.h - 22, w: width, h: 18,
  }, namedAs('stamp', stamp));
}
