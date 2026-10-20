// Text coverage between two SVGs (`svg-diagram diff --text old.svg new.svg`): when a hand-written SVG is redrawn in the DSL,
// which words, numbers and labels of the old picture are gone from the new one -- and which are new.
// Pure string work. Line wrapping does not matter: a label split over several <text> / <tspan> lines is matched against the whole text of the
// other picture with spaces, punctuation, width and case normalised away (the same rules as `check --covers`), so it also works for CJK.

import {checkCovers, type Cell, type Uncovered} from './covers.ts';
import {elements, parseXml, type El} from './svg-dom.ts';

export interface TextCoverage {
  /** old labels with words / numbers the new picture does not carry */
  missing: Uncovered[];
  /** new labels with words / numbers the old picture did not carry */
  added: Uncovered[];
  oldCount: number;
  newCount: number;
}

// a tspan that starts a new line (x / y / dy) is a break; one that only restyles a run is not
const breaks = (e: El): boolean => 'x' in e.attrs || 'y' in e.attrs || 'dy' in e.attrs;
function flat(e: El): string {
  return e.children.map(c => typeof c === 'string' ? c : (breaks(c) ? ' ' : '') + flat(c)).join('');
}

/** One cell per <text> that has any visible characters, in document order (`line` is its 1-based position). */
export function textCells(svg: string): Cell[] {
  const cells: Cell[] = [];
  for (const e of elements(parseXml(svg))) {
    if (e.tag !== 'text') continue;
    const t = flat(e).replace(/\s+/g, ' ').trim();
    if (t) cells.push({text: t, line: cells.length + 1});
  }
  return cells;
}

const joined = (cells: Cell[]): string => cells.map(c => c.text).join('\n');

export function textCoverage(oldSvg: string, newSvg: string): TextCoverage {
  const a = textCells(oldSvg), b = textCells(newSvg);
  return {missing: checkCovers(a, joined(b)), added: checkCovers(b, joined(a)), oldCount: a.length, newCount: b.length};
}

/** The report as lines of text. `withAdded: false` leaves out what only the new picture has. */
export function formatTextCoverage(r: TextCoverage, withAdded = true): string[] {
  const lines: string[] = [];
  const section = (title: string, items: Uncovered[]) => {
    lines.push(`${title}: ${items.length} 件`);
    for (const u of items) lines.push(`  - 「${u.cell.text}」（#${u.cell.line}）${u.missing.length === 1 && u.missing[0] === u.cell.text ? '' : ` 欠けた語: ${u.missing.join('、')}`}`);
  };
  section('旧にあって新にない文字', r.missing);
  if (withAdded) section('新にあって旧にない文字', r.added);
  lines.push(r.missing.length ? `→ 旧の文字が ${r.missing.length} 件、新に残っていない` : '→ 旧の文字はすべて新に残っている');
  return lines;
}
