// The layout findings the real comic band reports (its `findings` field) as BandDef verify output.
import type {LaidOutComic} from '../../../lib/types/comic.ts';
export const checkComicFindings = (laid: LaidOutComic) => laid.findings.map(f => ({rule: `comic/${f.rule}`, severity: f.severity === 'problem' ? 'problem' as const : 'info' as const, message: f.message}));
