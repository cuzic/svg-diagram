import {must} from './must.ts';
import {renderBands} from './core.ts';
import {MAX_EMOJI, MAX_TOTAL_TEXT, SPEC_VERSION, SPEC_WIDTH, SpecError, list, object, oneOf, text, withoutSchemaField} from './spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from './spec-kit.ts';
import {capped, checkAnchors, countEmoji, totalText, validateAgainst} from './spec-validation.ts';
import type {Theme} from './types/core.ts';

type SelectedBand = Parameters<typeof renderBands>[0][number];
type Connectors = Parameters<typeof renderBands>[1]['connectors'];
export type SelectedPart = PartDef<SelectedBand | readonly SelectedBand[]> & {connectors?: Connectors};
export type {Json, JsonSchema, SpecIssue} from './spec-kit.ts';
export {SpecError} from './spec-kit.ts';

type PartOptions = {parts: readonly SelectedPart[]};

const SCHEMA_KEYS = {
  type: true, description: true, const: true, enum: true, properties: true, required: true,
  additionalProperties: true, items: true, oneOf: true, minItems: true, maxItems: true,
  minLength: true, maxLength: true, minimum: true, maximum: true,
} satisfies Record<keyof JsonSchema, true>;

function checkSchema(schema: JsonSchema, path: string): void {
  for (const key of Object.keys(schema)) {
    if (!Object.hasOwn(SCHEMA_KEYS, key)) throw new Error(`spec: unsupported schema keyword "${key}" at ${path}`);
  }
  for (const [key, child] of Object.entries(schema.properties ?? {})) checkSchema(child, `${path}.properties.${key}`);
  if (schema.items) checkSchema(schema.items, `${path}.items`);
  schema.oneOf?.forEach((child, i) => checkSchema(child, `${path}.oneOf[${i}]`));
}

function registry(parts: readonly SelectedPart[]): Map<string, SelectedPart> {
  if (parts.length === 0) throw new Error('spec: supply at least one part');
  const result = new Map<string, SelectedPart>();
  for (const part of parts) {
    if (result.has(part.type)) throw new Error(`spec: duplicate part "${part.type}"`);
    if (part.schema.type !== 'object' || part.schema.properties?.['type']?.const !== part.type) {
      throw new Error(`spec: "${part.type}" needs an object schema with a matching type field`);
    }
    checkSchema(part.schema, part.type);
    result.set(part.type, part);
  }
  return result;
}

/** Schema of the parts supplied by the caller and the document options supported by renderBands. */
export function specSchemaFor({parts}: PartOptions): JsonSchema {
  return documentSchema([...registry(parts).values()]);
}

function documentSchema(parts: readonly SelectedPart[]): JsonSchema {
  return object({
    version: {const: SPEC_VERSION, description: 'Always 1.'},
    title: text('The accessible name of the figure.', 120),
    theme: oneOf('blue', 'teal', 'amber'),
    width: {type: 'integer', minimum: SPEC_WIDTH.min, maximum: SPEC_WIDTH.max},
    legend: {enum: [false]},
    parts: list({oneOf: parts.map(part => part.schema)}, 4, 1),
  }, ['version', 'title', 'parts']);
}

export function partCatalog({parts}: PartOptions) {
  return [...registry(parts).values()].map(({type, description, schema, example}) => ({type, description, schema, example}));
}

type SpecDocument = {title: string; theme?: Theme; width?: number; parts: Json[]};

function assemble(written: unknown, options: PartOptions) {
  const parts = registry(options.parts);
  const input = withoutSchemaField(written);
  const issues = validateAgainst(documentSchema([...parts.values()]), input);
  const bands: SelectedBand[] = [];
  const doc = input as SpecDocument;
  if (issues.length) return {doc, bands, issues: capped(issues)};
  const chars = totalText(input);
  if (chars > MAX_TOTAL_TEXT) return {doc, bands, issues: [{path: '', message: `holds ${chars} characters of text; the limit is ${MAX_TOTAL_TEXT}`}]};
  const emoji = countEmoji(input);
  if (emoji > MAX_EMOJI) return {doc, bands, issues: [{path: '', message: `holds ${emoji} emoji; the limit is ${MAX_EMOJI}`}]};
  const partOf = (type: unknown) => typeof type === 'string' ? parts.get(type) : undefined;
  doc.parts.forEach((part, index) => must(partOf(part['type'])).check(part, `parts[${index}]`, issues));
  checkAnchors(doc.parts, issues, partOf);
  if (issues.length) return {doc, bands, issues: capped(issues)};
  doc.parts.forEach((part, index) => {
    const at = `parts[${index}]`;
    try {
      const built = must(partOf(part['type'])).build(part, at);
      bands.push(...[built].flat());
    } catch (error) {
      if (error instanceof SpecError) issues.push(...error.issues);
      else issues.push({path: at, message: error instanceof Error ? error.message : String(error)});
    }
  });
  return {doc, bands, issues: capped(issues)};
}

export function validateSpec(input: unknown, options: PartOptions): SpecIssue[] {
  return assemble(input, options).issues;
}

export async function renderSpec(input: unknown, options: PartOptions & Pick<Parameters<typeof renderBands>[1], 'measure'>) {
  const {doc, bands, issues} = assemble(input, options);
  if (issues.length) throw new SpecError(issues);
  const connectors = options.parts.find(part => part.connectors)?.connectors;
  return renderBands(bands, {measure: options.measure, title: doc.title, theme: doc.theme, width: doc.width, connectors});
}
