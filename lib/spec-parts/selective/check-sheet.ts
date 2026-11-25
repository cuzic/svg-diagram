import {defineCheckSheetPart} from '../check-sheet.ts';
import {checkSheet} from '../../bands/table.ts';

export const checkSheetPart = /* @__PURE__ */ defineCheckSheetPart<ReturnType<typeof checkSheet>>(checkSheet);
