import {areas} from '../../bands/areas.ts';
import {box} from '../../bands/box.ts';
import {caption} from '../../bands/caption.ts';
import {connect} from '../../bands/connect.ts';
import {group} from '../../bands/group.ts';
import {defineBoardPart} from '../board-definition.ts';

type BoardBand = ReturnType<typeof areas | typeof box | typeof caption | typeof connect | typeof group>;

export const boardPart = /* @__PURE__ */ defineBoardPart<BoardBand>({areas, box, caption, connect, group});
