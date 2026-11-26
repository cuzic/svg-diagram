import {qualify, scopeOf} from './scope-name.ts';
import type {LaidOutChat} from './types/chat.ts';
import type {CheckRect} from './types/verdicts.ts';

/** The overlap check's rectangles of a chat: one per message, holding its blanks (a blank anchor lies inside its bubble). */
export function chatRects(band: LaidOutChat): CheckRect[] {
  const scope = scopeOf(band);
  return band.bubbles.map(({id, x, y, w, h, slots}, i) => {
    const holds = i === 0 && band.id ? [band.id] : [];
    for (const s of slots) holds.push(qualify(scope, s.id));
    return {id: qualify(scope, id), label: `chat message ${id}`, x, y, w, h, holds};
  });
}
