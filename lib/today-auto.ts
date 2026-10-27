// gantt({today: 'auto'}) filled in with the day the caller gave. Split from today.ts, which reads the environment, so the browser entry can use it.
import type {Band} from './types/index.ts';

/** Writes `today` into every gantt that says 'auto'. Returns whether there was one (the date then goes in the SVG's metadata). */
export function fillAutoToday(bands: Band[], today: string | undefined): boolean {
  let used = false;
  for (const b of bands) if (b.type === 'gantt' && b.today === 'auto') {
    if (today === undefined) throw new Error("gantt(): today: 'auto' needs a date: pass --today YYYY-MM-DD (build / check), set SVG_DIAGRAM_TODAY, or put \"today\" in .svg-diagram.json");
    b.today = today; used = true;
  }
  return used;
}
