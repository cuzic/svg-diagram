import type { PartDef } from '../spec-kit.ts';
/** Nodes of a board, the nested ones included. */
export declare const BOARD_MAX_NODES = 24;
export declare const BOARD_MAX_LINKS = 40;
/** Children of one group. */
export declare const BOARD_MAX_CHILDREN = 8;
interface BoardBuilders<Result> {
    areas(template: string[], cells: never, opts: never): Result;
    box(opts: never): Result;
    caption(text: string, opts: never): Result;
    connect(from: string, to: string, opts: never): Result;
    group(children: never, opts: never): Result;
}
export declare function defineBoardPart<Result>({ areas, box, caption, connect, group }: BoardBuilders<Result>): PartDef<Result[]>;
export {};
