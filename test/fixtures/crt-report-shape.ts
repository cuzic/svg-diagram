// ADR 0070 U0: the shape of the CRT a user reported as hard to read (2026-11-20), without its words. The nodes, the links (and the
// ANDs among them), the roles and the causeTree / canvas options are the report's; each label is dummy text of the same number of
// characters, so that boxes wrap to about the same sizes. The report's own file is the user's and is not in the repository.
import {causeTree, diagram} from '../../lib/dsl.ts';
import type {CauseLink, CauseNode, CauseOpts} from '../../lib/types/diagrams.ts';

const FILLER = [...'仮の文言をここに置きます'];
/** Dummy text `n` characters long; `seed` shifts where the filler starts, so that no two labels read the same. */
const filler = (n: number, seed: number): string => Array.from({length: n}, (_, i) => FILLER[(i + seed) % FILLER.length]).join('');

// [id, role, label length, sub length]
const SHAPE: readonly [string, CauseNode['role'] | undefined, number, number?][] = [
  ['pre1', 'precondition', 25], ['pre2', 'precondition', 32], ['pre3', 'precondition', 33], ['pre4', 'precondition', 26],
  ['r1', 'root', 25], ['r2', 'root', 23, 15], ['r3', 'root', 33], ['r4', 'root', 26], ['r5', 'root', 33], ['r6', 'root', 23],
  ['e1', undefined, 25], ['e2', undefined, 18], ['e3a', undefined, 25], ['e3b', undefined, 22], ['e3', undefined, 36], ['e4', undefined, 22], ['e7', undefined, 27], ['e8', undefined, 29],
  ['u1', 'ude', 28], ['u2', 'ude', 26], ['u3', 'ude', 41], ['u4', 'ude', 12], ['u5', 'ude', 20], ['u6', 'ude', 19], ['u7', 'ude', 27],
];

export const CRT_REPORT_NODES: CauseNode[] = SHAPE.map(([id, role, n, sub], i) => ({id, ...(role ? {role} : {}), label: filler(n, i), ...(sub === undefined ? {} : {sub: filler(sub, i + 5)})}));

export const CRT_REPORT_LINKS: CauseLink[] = [
  {from: ['r2', 'pre2'], to: 'e1'},
  {from: 'e1', to: 'u1'},
  {from: ['pre1', 'r1'], to: 'e2'},
  {from: ['r1', 'r4'], to: 'u5'},
  {from: 'u5', to: 'e2'},
  {from: 'r3', to: 'e3a'},
  {from: 'r2', to: 'e3b'},
  {from: 'e3a', to: 'e3'},
  {from: 'e3b', to: 'e3'},
  {from: 'e2', to: 'e3'},
  {from: ['u1', 'e3'], to: 'u2'},
  {from: 'e2', to: 'u2'},
  {from: 'e3', to: 'u3'},
  {from: 'r5', to: 'u3'},
  {from: 'r6', to: 'u3'},
  {from: 'e2', to: 'e4'},
  {from: 'r1', to: 'e7'},
  {from: 'e4', to: 'e8'},
  {from: 'e7', to: 'e8'},
  {from: ['e8', 'pre3'], to: 'u4'},
  {from: ['u3', 'pre4'], to: 'u4'},
  {from: 'u2', to: 'u6'},
  {from: 'u3', to: 'u6'},
  {from: 'u6', to: 'u7'},
  {from: 'u4', to: 'u7'},
];

/** The report's causeTree options, without `layer` (the user wrote `layer: 'alap'` after the report; the default is what is measured). */
export const CRT_REPORT_OPTIONS: CauseOpts = {tree: 'crt', dir: 'up', maxNodeW: 260, fold: true, coreDriver: true, coreDriverLabel: 'UDE {n}/{total}', roleTags: true};

/** The report's figure: its title, legend and canvas, and its cause tree; `opts` is laid over the cause tree's options (e.g. `{layer: 'asap'}`),
 *  `width` over the canvas width (a wider canvas, where no layer is folded into rows, shows each layer on one row). */
export const crtReportShape = (opts: Partial<CauseOpts> = {}, width = 2600, height = 2000) => diagram({theme: 'blue', title: filler(31, 0), showTitle: true, legend: 'auto', canvas: {width, height, minText: 18, fit: 'content'}})
  .add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, {...CRT_REPORT_OPTIONS, ...opts}));
