import type {SourceLoc} from './source-location.ts';
import type {SourceRef} from './source-ref.ts';
import type {Issue} from './types/verdicts.ts';

export type ResolveSource = (ref: SourceRef | undefined) => {loc?: SourceLoc; via: SourceLoc[]};

export function findingLocation(file: string, {loc, via}: ReturnType<ResolveSource>) {
  const at = loc && (loc.file === file ? {line: loc.line, column: loc.column} : {location: loc});
  return {...at, ...(via.length ? {via: via.map(({line, column}) => ({line, column}))} : {})};
}

/** The JSON form shared by check and the build source map. */
export function layoutFinding(file: string, issue: Issue, resolve: ResolveSource) {
  const related = issue.related?.flatMap(ref => {
    const {loc} = resolve(ref);
    return loc ? [loc] : [];
  });
  return {file, rule: 'layout', severity: 'error' as const, message: issue.message, ...findingLocation(file, resolve(issue.loc)), ...(related?.length ? {related} : {})};
}
