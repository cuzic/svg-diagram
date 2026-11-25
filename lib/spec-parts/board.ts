import {areas, box, caption, connect, group} from '../dsl-pure.ts';
import type {Band} from '../types/index.ts';
import {defineBoardPart} from './board-definition.ts';

export {BOARD_MAX_NODES, BOARD_MAX_LINKS, BOARD_MAX_CHILDREN} from './board-definition.ts';

export const BOARD = defineBoardPart<Band>({areas, box, caption, connect, group});
