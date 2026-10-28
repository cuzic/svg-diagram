import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutTable } from '../types/sequence-table-swimlane.ts';
import { type Fonts } from './xml.ts';
export declare function tableXml(id: number, b: LaidOutTable, day: LaidOutDiagram['day'], fonts: Fonts): string;
