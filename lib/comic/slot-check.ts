// The checks of the blanks of one line of speech, shared by comic() and chat() (ADR 0074 D4 / D7): a blank is defined, unique, within its `max`, and has a prompt.
import {SLOT_MAX} from './constants.ts';
import {slotIdsOf} from './template.ts';
import type {TemplatePart} from './template.ts';
import type {ComicDialogue, ComicRule, ComicSlotDef} from '../types/comic.ts';

export interface SlotInfo {max: number; def: ComicSlotDef | undefined}
export const slotMax = (def: ComicSlotDef | undefined): number | undefined => def?.max ?? (def?.choices?.length ? Math.max(...def.choices.map(c => [...c].length)) : undefined);

/** A blank's definition and the full-width characters it reserves (4 when it has no definition). */
export function slotInfo(dlg: ComicDialogue, sid: string): SlotInfo {
  const def = dlg.slots && Object.hasOwn(dlg.slots, sid) ? dlg.slots[sid] : undefined;
  return {max: slotMax(def) ?? 4, def};
}

/** Reports the mistakes of a line's blanks through `add`; `seen` is every blank id so far in the worksheet, `panelSlots` (comic only) the blanks of the panel. */
export function checkDialogueSlots(dlg: ComicDialogue, id: string, parts: readonly TemplatePart[], seen: Set<string>, add: (rule: ComicRule, where: string, message: string) => void, panelSlots?: Set<string>): void {
  for (const sid of slotIdsOf(parts)) {
    const {def} = slotInfo(dlg, sid);
    panelSlots?.add(sid);
    if (!def) add('comic-slot-undefined', id, `{${sid}} in ${id} has no definition in slots`);
    if (seen.has(sid)) add('comic-slot-duplicate', id, `blank id ${sid} is used twice (a blank id is unique in the whole worksheet)`);
    seen.add(sid);
    if (def) {
      const m = slotMax(def);
      if (m === undefined || !Number.isInteger(m) || m < 1 || m > SLOT_MAX) add('comic-slot-max', id, `max of ${sid} is ${m ?? 'not given'}: use a whole number from 1 to ${SLOT_MAX}`);
      else {
        if (def.fallback !== undefined && [...def.fallback].length > m) add('comic-slot-max', id, `fallback of ${sid} has ${[...def.fallback].length} characters, more than its max ${m}`);
        for (const c of def.choices ?? []) if ([...c].length > m) add('comic-slot-max', id, `choice "${c}" of ${sid} has ${[...c].length} characters, more than its max ${m}`);
      }
      const pl = [...(def.prompt ?? '')].length;
      if (pl < 2 || pl > 4) add('comic-slot-prompt', id, `prompt of ${sid} has ${pl} characters (use 2 to 4)`);
    }
  }
  for (const sid of Object.keys(dlg.slots ?? {})) if (!slotIdsOf(parts).includes(sid)) add('comic-slot-undefined', id, `slots has "${sid}", but tpl of ${id} has no {${sid}}`);
}
