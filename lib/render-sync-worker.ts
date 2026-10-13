// Child process for lib/markdown-it.ts: `node render-sync-worker <source.ts>` prints renderSource()'s result as JSON.
import {renderSource, close} from './render-source.ts';
try {
  const r = await renderSource(process.argv[2]);
  process.stdout.write(JSON.stringify({svg: r.svg, ok: r.ok, problems: r.problems, deps: r.deps}));
} catch (e) {
  process.stdout.write(JSON.stringify({error: (e as Error).message}));
} finally {
  await close();
}
