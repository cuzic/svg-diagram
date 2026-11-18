import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutTable } from '../types/sequence-table-swimlane.ts';
import { type Fonts } from './xml.ts';
/**
 * A table as a PowerPoint table, drawn as the svg draws it (emit-tables.ts renderTable): the title bar in the accent with white text, the
 * header row and a row heading column soft, a row of a tone that tone's fill; thin border-coloured lines inside, a dark frame around and a
 * dark line after the row heading column; each cell's text in its own colour, at the svg's place (the top inset puts the first baseline
 * where the svg has it). Not mapped: the rounded corners (a table's are square) and a cell's icon.
 */
export declare function tableXml(id: number, b: LaidOutTable, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts): string;
