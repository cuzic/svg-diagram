import {acceptHint, lintDiagram, mergeFindingSides, walkBands} from './rules.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutDiagram} from './types/index.ts';
import type {Issue, Verdict} from './types/verdicts.ts';
import {verifyWithServices} from './verify-core.ts';
import {CHECK_PHASES, collectRects, contrastProblems, runCheckPhase} from './verify-handlers.ts';

const services = {
  collectRects, contrastProblems, lintDiagram, acceptHint, mergeFindingSides,
  hasMutedBox: (d: LaidOutDiagram) => walkBands(d.bands).some(b => b.type === 'box' && b.tone === 'muted'),
  checkFigures(d: LaidOutDiagram, tones: ToneEnv) {
    const issues: Issue[] = [], warnings: string[] = [];
    for (const phase of CHECK_PHASES) runCheckPhase(d, tones, phase, issues, warnings);
    return {issues, warnings};
  },
};

export function verifyDiagram(d: LaidOutDiagram): Verdict {
  return verifyWithServices(services, d);
}
