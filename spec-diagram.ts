// svg-diagram spec <spec.json> --part <name> [--part <name> ...]
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {must} from './lib/must.ts';
import {specPartLoaders} from './lib/spec-cli-parts.ts';

const USAGE = 'svg-diagram spec <spec.json> --part <name> [--part <name> ...]';

async function main(): Promise<number> {
  const {positionals, values} = parseArgs({
    allowPositionals: true,
    options: {part: {type: 'string', multiple: true}, help: {type: 'boolean', short: 'h'}},
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const [file] = positionals;
  if (positionals.length !== 1 || !file || !values.part?.length) {
    console.error(USAGE);
    return 2;
  }
  const names = [...new Set(values.part)];
  for (const name of names) {
    if (!Object.hasOwn(specPartLoaders, name)) throw new Error(`--part に指定できない部品です「${name}」。spec/parts の公開名を指定してください`);
  }
  const input: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const doc = input !== null && typeof input === 'object' ? input as Record<string, unknown> : {};
  const [parts, {renderSpec}, captions, autoLegend] = await Promise.all([
    Promise.all(names.map(name => must(specPartLoaders[name])())),
    import('./lib/spec-selective-node.ts'),
    doc['showTitle'] === true || typeof doc['sourceLine'] === 'string'
      ? import('./lib/bands/caption.ts').then(m => m.captionDefinition) : undefined,
    doc['legend'] === 'auto' ? import('./lib/bands/legend.ts').then(m => m.autoLegend) : undefined,
  ]);
  const result = await renderSpec(input, {parts, captions, autoLegend});
  for (const report of [...result.issues, ...result.problems, ...result.findings]) {
    console.error(report.path ? `${report.path} ${report.message}` : report.message);
  }
  if (result.svg !== null) process.stdout.write(result.svg);
  return result.ok ? 0 : 1;
}

try { process.exitCode = await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
