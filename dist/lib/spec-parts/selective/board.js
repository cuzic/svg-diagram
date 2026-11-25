import { areas } from '../../bands/areas.js';
import { box } from '../../bands/box.js';
import { caption } from '../../bands/caption.js';
import { connect } from '../../bands/connect.js';
import { group } from '../../bands/group.js';
import { defineBoardPart } from '../board-definition.js';
export const boardPart = /* @__PURE__ */ defineBoardPart({ areas, box, caption, connect, group });
