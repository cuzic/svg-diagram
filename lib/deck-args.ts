// `svg-diagram deck`'s command line, as a pure function of the argument list: the entry only prints the error and exits 2.

export const DECK_USAGE = 'Usage: svg-diagram deck <a.ts|a.svg>... [--out deck.html] [--title TEXT] [--cols N] [--csp] [--no-source-line] [--render svg]\n  (a deck views figures that build / check have passed; it does not lint them)';

const VALUE = ['--out', '--title', '--cols', '--render'];
const BOOL = ['--csp', '--no-source-line'];

export interface DeckArgs {files: string[]; out: string; title?: string; cols?: number; csp: boolean; noSourceLine: boolean}
/** `error` is the message to print above the usage line; '' is the bare usage (no input). */
export type DeckArgsResult = {ok: true; args: DeckArgs} | {ok: false; error: string};

export function parseDeckArgs(args: readonly string[]): DeckArgsResult {
  const fail = (error: string): DeckArgsResult => ({ok: false, error});
  for (const [i, a] of args.entries()) {
    if (a.startsWith('--') && ![...VALUE, ...BOOL].includes(a)) return fail(`unknown option ${a}`);
    if (VALUE.includes(a) && (args[i + 1] === undefined || args[i + 1].startsWith('--'))) return fail(`${a} needs a value`);
  }
  const val = (n: string): string | undefined => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  const files = args.filter((a, i) => !a.startsWith('--') && !VALUE.includes(args[i - 1]!));
  if (!files.length) return fail('');
  const bad = files.find(f => !/\.(ts|svg)$/.test(f));
  if (bad !== undefined) return fail(`${bad}: a deck takes .ts sources and .svg files`);
  const colsArg = val('--cols');
  const cols = colsArg === undefined ? undefined : Number(colsArg);
  if (cols !== undefined && !(Number.isInteger(cols) && cols >= 1)) return fail(`--cols needs a whole number of 1 or more (got ${colsArg})`);
  const render = val('--render') ?? 'svg';
  if (render === 'html') return fail('--render html is not available yet (the SVG form is the one deck draws)');
  if (render !== 'svg') return fail(`--render is svg (got ${render})`);
  const title = val('--title');
  return {ok: true, args: {files, out: val('--out') ?? 'deck.html', ...(title !== undefined ? {title} : {}), ...(cols !== undefined ? {cols} : {}), csp: args.includes('--csp'), noSourceLine: args.includes('--no-source-line')}};
}
