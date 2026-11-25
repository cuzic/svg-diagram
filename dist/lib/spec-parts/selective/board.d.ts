import { areas } from '../../bands/areas.ts';
import { box } from '../../bands/box.ts';
import { caption } from '../../bands/caption.ts';
import { connect } from '../../bands/connect.ts';
import { group } from '../../bands/group.ts';
type BoardBand = ReturnType<typeof areas | typeof box | typeof caption | typeof connect | typeof group>;
export declare const boardPart: import("../../spec-kit.ts").PartDef<BoardBand[]>;
export {};
