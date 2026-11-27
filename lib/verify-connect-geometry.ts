import {ceil4, connectRoom} from './connect-rules.ts';
import {sourceOf} from './source-ref.ts';
import {issueAt, labelOf, rectOverlap} from './verify-base.ts';
import type {LaidOutConnect} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {LaidOutCaption} from './types/text-bands.ts';
import type {CheckRect, Issue} from './types/verdicts.ts';

// A connect()'s path/label are allowed to touch or start from their own
// endpoint boxes (that's the whole point) — only flag collision with
// anything ELSE.
function checkConnects(d: LaidOutDiagram, rects: CheckRect[]): Issue[] {
  const issues: Issue[] = [];
  for (const c of d.connects) {
    const who = connectName(c);
    const loc = sourceOf(c);
    const within = (r: CheckRect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    // an end that is a row / a column of a row (row({id})) owns the boxes in it (a box spanning several columns belongs to each of them)
    const isOwnEndpoint = (r: CheckRect) => (r.id !== null && (r.id === c.fromId || r.id === c.toId)) || !!r.holds?.some(h => h === c.fromId || h === c.toId) || within(r, c.fromArea) || within(r, c.toArea) || within(r, c.fromVia) || within(r, c.toVia); // the boxes in a frame an end stops on (connect({via})) too
    for (const r of rects) {
      if (isOwnEndpoint(r)) {
        // The path starts on its own boxes, but the label/chip must not sit on top of their text:
        // a chip wider than the gap between two boxes lands on both bodies.
        const own = c.labelBox && rectOverlap(c.labelBox, r);
        if (own) issues.push(issueAt(`${who} label "${c.label}" overlaps its own end "${r.label}" by ${Math.round(own.dx)}x${Math.round(own.dy)}px (${widenHint(c)}, shorten the label, or label a longer leg with route: 'elbow')`, loc, r.loc));
        continue;
      }
      for (const seg of c.pathSegments) {
        const pathHit = rectOverlap(seg, r);
        if (pathHit) issues.push(issueAt(`${who} path overlaps "${r.label}" by ${Math.round(pathHit.dx)}x${Math.round(pathHit.dy)}px${c.route === 'loop-under' || c.route === 'loop-side' ? '' : " (a line back to an earlier box, or past a box in a row of steps / chevrons: route: 'loop-under' runs it under the boxes; between two anchors on the same left / right side of a column, route: 'loop-side' runs it outside)"}`, loc, r.loc));
      }
      if (c.labelBox) {
        const labelHit = rectOverlap(c.labelBox, r);
        if (labelHit) issues.push(issueAt(`${who} label "${c.label}" overlaps "${r.label}" by ${Math.round(labelHit.dx)}x${Math.round(labelHit.dy)}px`, loc, r.loc));
      }
    }
    // a swimlane's way back keeps its chip off the other flows (its layout slides it along the line); what is left is reported
    if (c.under && c.labelBox) for (const o of d.connects) if (o !== c && [o.labelBox, ...o.pathSegments].some(r => r && rectOverlap(c.labelBox as Rect, r))) issues.push(issueAt(`${who} label overlaps ${connectName(o)}`, loc, sourceOf(o)));
  }
  return issues;
}

/** "widen the gap between the boxes", with the room the label needs on a straight connect (labelRoom(), ADR 0069 D1). */
const widenHint = (c: LaidOutConnect): string => { const need = connectRoom(c); return need !== undefined && Number.isFinite(need) ? `widen the gap between the boxes to ${ceil4(need)}px or more` : 'widen the gap between the boxes'; };

const connectName = (c: LaidOutConnect): string =>
  c.annot?.kind === 'callout' ? `callout(${c.toLabel})` : c.annot?.kind === 'bracket' ? `bracket(${c.fromLabel}, ${c.toLabel})` : `connect(${c.fromLabel} -> ${c.toLabel})`;

// bracket() / callout() reserve no room above, left or right of their boxes (only 'below' pushes what follows down), so their line
// and label can leave the canvas or land on a caption, which the other checks do not cover (captions are not obstacles for connect()).
function checkAnnotations(d: LaidOutDiagram): Issue[] {
  const issues: Issue[] = [];
  const captions = d.laidOut.filter((b): b is LaidOutCaption => b.type === 'caption' && !b.inkBox);
  for (const c of d.connects) {
    if (!c.annot) continue;
    const who = connectName(c);
    const loc = sourceOf(c);
    const parts: [string, Rect][] = [...c.pathSegments.map((r): [string, Rect] => ['line', r]), ...(c.labelBox ? [[`label "${c.label}"`, c.labelBox] as [string, Rect]] : [])];
    const fix = c.annot.kind === 'callout' ? "put the bubble on another side, or leave room with spacer()" : "use side: 'below', or leave room with spacer()";
    for (const [what, r] of parts) {
      if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > d.width + 0.5 || r.y + r.h > d.canvasHeight + 0.5) issues.push(issueAt(`${who} ${what} runs outside the ${d.width}x${d.canvasHeight} canvas (${fix})`, loc));
      for (const cap of captions) {
        const o = rectOverlap(r, cap);
        if (o) issues.push(issueAt(`${who} ${what} overlaps the caption "${labelOf(cap)}" by ${Math.round(o.dx)}x${Math.round(o.dy)}px (${fix})`, loc, sourceOf(cap)));
      }
    }
  }
  return issues;
}

// A 'loop-side' line runs out past the boxes' side, into the margin; boxes that fill the canvas width leave none, and the line is cut off.
function checkLoopSide(d: LaidOutDiagram): Issue[] {
  const issues: Issue[] = [];
  for (const c of d.connects) {
    if (c.route !== 'loop-side') continue;
    const loc = sourceOf(c);
    const out = (r: Rect) => r.x < -0.5 || r.y < -0.5 || r.x + r.w > d.width + 0.5 || r.y + r.h > d.canvasHeight + 0.5;
    if (c.pathSegments.some(out)) issues.push(issueAt(`${connectName(c)} runs outside the ${d.width}x${d.canvasHeight} canvas: the boxes leave no room beside them for route: 'loop-side' (narrow them: row([box({id, width: 700})], {justify: 'center'}) per step, or give dip a smaller value)`, loc));
    else if (c.labelBox && out(c.labelBox)) issues.push(issueAt(`${connectName(c)} label "${c.label}" runs outside the ${d.width}x${d.canvasHeight} canvas: leave more room beside the boxes, or use chip: true (the label then sits on the line)`, loc));
  }
  return issues;
}

export function checkConnectionGeometry(diagram: LaidOutDiagram, rects: CheckRect[]): Issue[] {
  return [...checkConnects(diagram, rects), ...checkAnnotations(diagram), ...checkLoopSide(diagram)];
}
