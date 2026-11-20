// The JSON Schema files in schema/ (ADR 0071): what an editor reads to complete and check the project's JSON files as they are typed.
//   spec.schema.json    a figure written as a JSON spec (lib/spec.ts), drawn alone; it holds every part, the other files point at it
//   figure.schema.json  a .json figure a deck names: the same spec without canvas (the slide sizes it)
//   deck.schema.json    a deck (lib/deck-spec.ts), where a figure may also be the path of a .ts source or of a .json figure
//   site.schema.json    site.json (lib/site.ts, ADR 0067)
//   config.schema.json  .svg-diagram.json (lib/config.ts)
// The spec and the deck are made from the schemas the CLIs check with; site.json and .svg-diagram.json are written here, kept in step
// with Config by `satisfies` and with the CLIs by test/schema-files.test.ts. `pnpm schema` writes them and the test fails when the
// committed ones are stale. A schema says only what a shape can say; the CLIs' own checks (a part's rules, a cover's fields, the total
// text) still have the last word.
import {partCatalog, specSchema, type JsonSchema} from './spec.ts';
import {deckSchema} from './deck-spec.ts';
import {DEFAULT_LEGEND_LABELS, RULE_DOCS} from './rules.ts';
import {MIN_FONT_SIZE, MIN_TEXT_ABSOLUTE, TONES} from './tokens.ts';
import {RESERVED_SLUGS, SLUG} from './site.ts';
import type {FontFamily} from './types/core.ts';
import type {Config} from './types/project.ts';

/** A JSON Schema as written to a file: the subset lib/spec-kit.ts checks with, and the few keywords only the files use. */
export type SchemaNode = JsonSchema | {[key: string]: unknown};
/** Keywords only VS Code reads (completion and messages); a standard validator is told to ignore them. */
export const EDITOR_KEYWORDS = ['enumDescriptions', 'defaultSnippets', 'patternErrorMessage'] as const;

const DRAFT = 'http://json-schema.org/draft-07/schema#';
/** The field every file may start with: it names the schema for the editor, and the CLIs leave it out before checking. */
const schemaField = (file: string): SchemaNode => ({type: 'string', description: `The JSON Schema of this file, for the editor (such as "./node_modules/svg-diagram/schema/${file}"). The CLIs ignore it.`});
/** `schema` with `$schema` allowed at its top. */
const withSchemaField = (schema: SchemaNode, file: string): SchemaNode => ({...schema, properties: {$schema: schemaField(file), ...(schema as JsonSchema).properties}});

/** What the CLI refuses in a one-line text (lib/spec.ts: blank, or a control character such as a line break), as a pattern. */
const ONE_LINE = {pattern: '^(?=[\\s\\S]*\\S)[^\\u0000-\\u001f\\u007f-\\u009f]*$', patternErrorMessage: 'Write plain text on one line: not blank, no line break or other control character.'};
/** `node` with ONE_LINE on every text in it (a string with minLength, which the CLI reads as "not blank"). */
function oneLine(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(oneLine);
  if (typeof node !== 'object' || node === null) return node;
  const o = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === 'enum' || k === 'const' ? v : oneLine(v)]));
  return o['type'] === 'string' && o['minLength'] !== undefined && o['pattern'] === undefined && o['enum'] === undefined ? {...o, ...ONE_LINE} : o;
}

const typeOf = (b: JsonSchema): string => {
  const t = b.properties?.['type']?.const;
  if (typeof t !== 'string') throw new Error(`a part schema without a "type" const: ${JSON.stringify(b).slice(0, 80)}`);
  return t;
};

/**
 * A spec's `parts` as an editor reads them best: `type` first, from the list of every part (each with what it is for), and then the
 * fields of that part alone (if / then on `type`), each part written once in `definitions`. With the oneOf the CLIs check with, an
 * editor offers the type of the branch that fits best so far, and reports the fields of another part as missing.
 */
function partsDefinitions(): Record<string, SchemaNode> {
  const parts = specSchema.properties?.['parts'] as JsonSchema;
  const branches = (parts.items as JsonSchema).oneOf as readonly JsonSchema[];
  const catalog = new Map(partCatalog().map(p => [p.type, p]));
  const about = (b: JsonSchema): string => catalog.get(typeOf(b))?.description ?? '';
  const items = {
    type: 'object',
    properties: {type: {enum: branches.map(typeOf), enumDescriptions: branches.map(about), description: 'The kind of part: its fields follow from it.'}},
    required: ['type'],
    // biome-ignore lint/suspicious/noThenProperty: `then` is the JSON Schema keyword, not a thenable
    allOf: branches.map(b => ({if: {properties: {type: {const: typeOf(b)}}, required: ['type']}, then: {$ref: `#/definitions/part.${typeOf(b)}`}})),
    defaultSnippets: branches.map(b => ({label: typeOf(b), description: about(b), body: catalog.get(typeOf(b))?.example})),
  };
  return {
    parts: oneLine({...parts, items}) as SchemaNode,
    ...Object.fromEntries(branches.map(b => [`part.${typeOf(b)}`, oneLine({...b, description: about(b)}) as SchemaNode])),
  };
}

/** The spec's own fields (not its parts) with `parts` pointing at `parts` (the definitions of spec.schema.json, in this file or not). */
function specTop(parts: string, withCanvas: boolean): SchemaNode {
  const {canvas, parts: _parts, ...rest} = specSchema.properties ?? {};
  return oneLine({...specSchema, properties: {...rest, ...(withCanvas ? {canvas} : {}), parts: {$ref: parts}}}) as SchemaNode;
}
const FIGURE_DESCRIPTION = 'A figure: the same JSON spec as a single diagram, without canvas (the slide sizes it).';

const FIGURE_PATH = {type: 'string', pattern: '\\.(ts|json)$', patternErrorMessage: 'A figure path ends in .ts or .json (relative to this deck); or write the spec itself.', description: 'The path of a diagram source (.ts) or of a figure file (.json), relative to this deck file.'};

/** deckSchema with every figure the figure (written once) or the path of a figure file, as lib/deck-load.ts reads them. */
function deckFile(): SchemaNode {
  const props = deckSchema.properties as Record<string, JsonSchema>;
  const slides = props['slides'] as JsonSchema;
  const slide = slides.items as JsonSchema;
  const slideProps = slide.properties as Record<string, JsonSchema>;
  const columns = slideProps['columns'] as JsonSchema;
  const column = columns.items as JsonSchema;
  const columnProps = column.properties as Record<string, JsonSchema>;
  const figure = (description: string | undefined): SchemaNode => ({anyOf: [FIGURE_PATH, {$ref: '#/definitions/figure'}], ...(description ? {description} : {})});
  // notes and a column's text may hold line breaks (lib/deck-spec.ts takes them out before checking): not one-line texts
  const deck = oneLine(deckSchema) as {properties: {slides: {items: {properties: Record<string, {items: {properties: Record<string, unknown>}}>}}}};
  const oneLineSlide = deck.properties.slides.items.properties;
  const oneLineColumn = (oneLineSlide['columns'] as {items: {properties: Record<string, unknown>}}).items.properties;
  return {
    $schema: DRAFT,
    title: 'svg-diagram deck',
    ...withSchemaField({...deckSchema, properties: {
      ...deck.properties,
      slides: {...slides, items: {...slide, properties: {
        ...oneLineSlide,
        notes: slideProps['notes'],
        figure: figure(slideProps['figure']?.description),
        columns: {...columns, items: {...column, properties: {...oneLineColumn, text: columnProps['text'], figure: figure(columnProps['figure']?.description)}}},
      }}},
    }}, 'deck.schema.json'),
    definitions: {figure: {...(specTop('spec.schema.json#/definitions/parts', false) as object), description: FIGURE_DESCRIPTION}},
  };
}

const TEXT = {type: 'string', minLength: 1};
/** Every value of a union type, checked both ways: a value the type lacks, or a value of the type left out, does not compile. */
const every = <T>() => <const A extends readonly T[]>(values: A & ([T] extends [A[number]] ? unknown : never)): A => values;
const WRAPS = every<NonNullable<Config['wrap']>>()(['phrase', 'char', 'bunsetsu', 'bunsetsu-soft']);
const MEASURES = every<NonNullable<Config['measure']>>()(['font', 'chromium']);
const FONT_FAMILIES = every<FontFamily>()(['sans', 'mono', 'emoji']);
const COLOR = {type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'A #rrggbb colour.'};
const COLORS = {fill: COLOR, stroke: COLOR, text: COLOR, ink: COLOR};
const FONT_FILE = {type: 'string', minLength: 1, description: 'A font file, as "path" or "path#faceIndex"; a relative path is relative to this file\'s folder.'};
const FONT = {type: 'object', properties: {regular: FONT_FILE, bold: FONT_FILE}, additionalProperties: false};
const keyed = (keys: readonly string[], value: (key: string) => SchemaNode, description: string): SchemaNode =>
  ({type: 'object', properties: Object.fromEntries(keys.map(k => [k, value(k)])), additionalProperties: false, description});

/** Every field of .svg-diagram.json, as lib/config.ts checks it (`satisfies` keeps the list in step with Config). */
const CONFIG_FIELDS = {
  outDir: {...TEXT, description: 'Where build writes the SVGs when neither --out nor --out-dir is given (default "svg"), and where lint and check --drift look for them. Relative to this file\'s folder.'},
  accept: keyed(Object.keys(RULE_DOCS), k => ({...TEXT, description: `${RULE_DOCS[k as keyof typeof RULE_DOCS]}（許容する理由を書く）`}), 'Rules accepted for every diagram, each with the reason it is fine: {"rule-id": "why"}. An accepted finding drops to info.'),
  maxWidth: {type: 'number', exclusiveMinimum: 0, description: 'The widest every diagram may be, in px (a diagram\'s own maxWidth wins).'},
  terms: {type: 'object', additionalProperties: {type: 'array', items: TEXT, minItems: 1}, description: 'Glossary for every diagram: {"ユーザー": ["利用者", "ユザー"]}: the word to use, and the spellings check reports as term-avoid.'},
  legend: {enum: ['auto', false], description: 'The default for every diagram\'s legend (a diagram\'s own wins): false = no legend needed, "auto" = add the missing entries.'},
  legendLabels: keyed(Object.keys(DEFAULT_LEGEND_LABELS), k => ({...TEXT, description: `Default: ${DEFAULT_LEGEND_LABELS[k as keyof typeof DEFAULT_LEGEND_LABELS]}`}), 'Legend wording for every diagram, such as {"tone:accent": "注意"} (a diagram\'s own legendLabels win per key).'),
  tones: keyed(Object.keys(TONES), () => ({type: 'object', properties: {...COLORS, dark: {type: 'object', properties: COLORS, additionalProperties: false, description: 'What each colour becomes with appearance "dark".'}}, additionalProperties: false}), 'Tone colours for every diagram, such as {"accent": {"fill": "#e6d3bd"}} (a diagram\'s own tones win per colour).'),
  wrap: {enum: WRAPS, description: 'The default for every diagram\'s wrap (a diagram\'s own wins).'},
  keepWords: {type: 'boolean', description: 'The default for every diagram\'s keepWords: never break a katakana word across lines.'},
  measure: {enum: MEASURES, description: 'How text is measured: "font" (default) from the font files, no browser (see fonts); "chromium" in a headless browser. SVG_DIAGRAM_MEASURE wins.'},
  fonts: keyed(FONT_FAMILIES, () => FONT, 'Font files to measure with when measure is "font": per family, the regular and the bold (weight 600 or more) one. Unset: found with fontconfig.'),
  fontFloor: {type: 'number', minimum: MIN_TEXT_ABSOLUTE, maximum: MIN_FONT_SIZE, description: `The lowest canvas.minText a diagram may declare (${MIN_TEXT_ABSOLUTE} to ${MIN_FONT_SIZE}, default ${MIN_FONT_SIZE}).`},
  today: {type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'The day for gantt({today: \'auto\'}) when no --today or SVG_DIAGRAM_TODAY is given: YYYY-MM-DD.'},
} satisfies Record<Exclude<keyof Config, '_file' | '_today'>, SchemaNode>;

const SITE_DECK = {type: 'object', properties: {
  deck: {...TEXT, description: 'The deck file, relative to this site.json.'},
  slug: {type: 'string', pattern: SLUG.source, not: {enum: [...RESERVED_SLUGS]}, description: `The deck's folder in the site: lower-case letters, digits and "-" (made from the title when left out). Not one the site keeps for itself: ${[...RESERVED_SLUGS].join(', ')}.`},
  title: {type: 'string', description: 'The title on the site\'s index (the deck\'s own when left out).'},
}, required: ['deck'], additionalProperties: false};

/** Each file in schema/, by name. */
export function schemaFiles(): Record<string, SchemaNode> {
  return {
    'spec.schema.json': {$schema: DRAFT, title: 'svg-diagram spec', ...withSchemaField(specTop('#/definitions/parts', true), 'spec.schema.json'), definitions: partsDefinitions()},
    'figure.schema.json': {$schema: DRAFT, title: 'svg-diagram figure (a .json figure of a deck)', ...withSchemaField(specTop('spec.schema.json#/definitions/parts', false), 'figure.schema.json'), description: FIGURE_DESCRIPTION},
    'deck.schema.json': deckFile(),
    'site.schema.json': {$schema: DRAFT, title: 'svg-diagram site.json', type: 'object', properties: {
      $schema: schemaField('site.schema.json'),
      title: {type: 'string', description: 'The site\'s title, on its index.'},
      decks: {type: 'array', items: SITE_DECK, minItems: 1, description: 'The decks, in the order of the index.'},
      extra: {type: 'object', additionalProperties: {...TEXT, description: 'The file, relative to this site.json.'}, description: 'Files copied into the site: {"where in the site": "the file"}.'},
    }, required: ['decks'], additionalProperties: false},
    'config.schema.json': {$schema: DRAFT, title: 'svg-diagram .svg-diagram.json', description: 'Project-wide settings, found by walking up from the current directory.', type: 'object', properties: {$schema: schemaField('config.schema.json'), ...CONFIG_FIELDS}, additionalProperties: false},
  };
}

/** A file's text as written to schema/. */
export const schemaText = (schema: SchemaNode): string => `${JSON.stringify(schema, null, 2)}\n`;
