// pnpm schema: writes schema/*.schema.json from the schemas the CLIs check with (lib/schema-files.ts, ADR 0071).
import fs from 'node:fs';
import path from 'node:path';
import {schemaFiles, schemaText} from '../lib/schema-files.ts';

const dir = path.join(import.meta.dirname, '..', 'schema');
fs.mkdirSync(dir, {recursive: true});
for (const [name, schema] of Object.entries(schemaFiles())) {
  const file = path.join(dir, name), text = schemaText(schema);
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before === text) continue;
  fs.writeFileSync(file, text);
  console.log(`${before === null ? 'wrote' : 'updated'} schema/${name}`);
}
