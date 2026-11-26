import {at, findingAcceptanceHint} from './finding-rules.ts';
import {describeApplied} from './fit-width.ts';
import type {LaidOutBand} from './types/index.ts';
import type {Finding} from './types/verdicts.ts';

export const layoutFitRules = /* @__PURE__ */ Object.freeze({
  'auto-fit-applied': {doc: '幅に収まらないので、dir / maxNodeW を省略した図(causeTree・stateDiagram・flowchart・classDiagram・tree)をレイアウトが自動で変えた（dir を省略: warn、dir: \'auto\': info）。明示した dir / maxNodeW は変えず、収まらなければ試した案つきで throw する', scope: 'band'},
} as const);

const FIT_WHO = {cause: 'causeTree()', states: 'stateDiagram()', classes: 'classDiagram()', tree: 'tree() / mindmap()', fta: 'faultTree()', bowtie: 'bowtie()'} as const;
// what the layout changed on its own to make a figure fit its width (ADR 0010 D3): left out is a warning, `dir: 'auto'` is the author's own choice
export function layoutFitFindings(b: LaidOutBand): Finding[] {
  if ((b.type !== 'cause' && b.type !== 'states' && b.type !== 'classes' && b.type !== 'tree' && b.type !== 'fta' && b.type !== 'bowtie') || !b.fitApplied?.length) return [];
  const what = b.fitApplied.map(describeApplied).join('、'), auto = b.fitApplied.every(a => a.mode === 'auto');
  const noDir = b.type === 'fta' || b.type === 'bowtie' || ('mindmap' in b && b.mindmap); // a fault tree, a bow-tie and a mind map have no `dir`
  const knobs = noDir ? 'maxNodeW' : 'dir / maxNodeW', say = noDir ? "maxNodeW: 'auto'" : "dir: 'auto'";
  return [{...at(b), rule: 'auto-fit-applied', severity: auto ? 'info' : 'warn', message: auto
    ? `${b.type === 'states' && b.flavor === 'flowchart' ? 'flowchart()' : FIT_WHO[b.type]}: ${knobs} を 'auto' にしたため、幅に収まるようレイアウトが変えた: ${what}`
    : `${b.type === 'states' && b.flavor === 'flowchart' ? 'flowchart()' : FIT_WHO[b.type]}: ${knobs} を省略したため、幅に収まるようレイアウトが自動で変えた: ${what}。意図した変更なら ${say} と書く（info になる）。固定したいなら ${knobs} を明示する（収まらなければ試した案つきで止まる）`}];
}

export const layoutFitVerification = {
  layoutFindings: layoutFitFindings,
  acceptHint: (rule: string) => rule === 'auto-fit-applied' ? findingAcceptanceHint(rule) : undefined,
};
