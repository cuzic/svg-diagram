import { areas, box, caption, connect, group } from '../dsl-pure.js';
import { defineBoardPart } from './board-definition.js';
export { BOARD_MAX_NODES, BOARD_MAX_LINKS, BOARD_MAX_CHILDREN } from './board-definition.js';
export const BOARD = defineBoardPart({ areas, box, caption, connect, group });
