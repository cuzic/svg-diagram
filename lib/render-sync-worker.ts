// Child process for lib/markdown-it.ts: `node render-sync-worker <source.ts> <html: 0|1>` writes renderSource()'s result as JSON
// to file descriptor 3. The diagram source may print to stdout (console.log, a dependency's warning): that goes to stderr, so
// it can never get mixed into the result.
import fs from 'node:fs';
import {renderSource, close} from './render-source.ts';
import {must} from './must.ts';
console.log = console.error;
const send = (o: unknown) => fs.writeSync(3, JSON.stringify(o));
try {
  const r = await renderSource(must(process.argv[2]), {html: process.argv[3] === '1'});
  send({svg: r.svg, html: r.html, ok: r.ok, problems: r.problems, deps: r.deps});
} catch (e) {
  send({error: (e as Error).message});
} finally {
  await close();
}
