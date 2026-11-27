import {midWordFindings} from './mid-word-findings.ts';
import {findingAcceptanceHint} from './finding-rules.ts';
import {termFindings} from './term-rules.ts';
import {cloneData} from './clone-data.ts';
import {documentAcceptHint, documentFindings} from './document-findings.ts';
import {markSpecPart} from './source-ref.ts';
import {walkDefinedBands} from './band-def.ts';
import {oneLine} from './diagram-description.ts';
import type {Config} from './types/project.ts';
import type {Band} from './types/index.ts';
import {must} from './must.ts';
import {prepareBands, renderBands, type BatchMeasurement} from './core.ts';
import {LEGEND_EN, MAX_EMOJI, MAX_TOTAL_TEXT, PART_EN, SpecError, withoutSchemaField} from './spec-kit.ts';
import type {Json, JsonSchema, PartDef, SpecIssue} from './spec-kit.ts';
import {capped, checkAnchors, countEmoji, totalText, validateAgainst} from './spec-validation.ts';
import {schemaForParts} from './spec-schema.ts';

type SelectedBand = Parameters<typeof renderBands>[0][number];
type Connectors = Parameters<typeof renderBands>[1]['connectors'];
export type SelectedPart = PartDef<SelectedBand | readonly SelectedBand[]> & {connectors?: Connectors};
export type {Json, JsonSchema, SpecIssue} from './spec-kit.ts';
export {SpecError} from './spec-kit.ts';

type PartOptions = {
  parts: readonly SelectedPart[];
  autoLegend?: (bands: readonly SelectedBand[], labels?: Partial<Record<string, string>>) => SelectedBand | undefined;
};

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
export function specSchemaFor({parts, autoLegend}: PartOptions): JsonSchema {
  return schemaForParts([...registry(parts).values()], autoLegend !== undefined);
}

export function partCatalog({parts}: PartOptions) {
  return [...registry(parts).values()].map(({type, description, schema, example}) => ({type, description, schema, example}));
}

type RenderOptions = Parameters<typeof renderBands>[1];
type SpecDocument = Pick<RenderOptions, 'theme' | 'width' | 'appearance' | 'density' | 'desc' | 'showTitle' | 'sourceLine' | 'canvas'>
  & {title: string; lang?: 'en' | 'ja'; legend?: 'auto' | false; parts: Json[]};

function assemble(written: unknown, options: PartOptions) {
  const parts = registry(options.parts);
  const input = withoutSchemaField(written);
  const issues = validateAgainst(schemaForParts([...parts.values()], options.autoLegend !== undefined), input);
  const bands: SelectedBand[] = [];
  const doc = input as SpecDocument;
  if (issues.length) return {doc, bands, issues: capped(issues)};
  if (doc.width !== undefined && doc.canvas !== undefined) {
    return {doc, bands, issues: [{path: 'width', message: 'does not go with canvas: give the canvas its width (canvas.width) and leave width out'}]};
  }
  const chars = totalText(input);
  if (chars > MAX_TOTAL_TEXT) return {doc, bands, issues: [{path: '', message: `holds ${chars} characters of text; the limit is ${MAX_TOTAL_TEXT}`}]};
  const emoji = countEmoji(input);
  if (emoji > MAX_EMOJI) return {doc, bands, issues: [{path: '', message: `holds ${emoji} emoji; the limit is ${MAX_EMOJI}`}]};
  const partOf = (type: unknown) => typeof type === 'string' ? parts.get(type) : undefined;
  const list = doc.lang === 'en' ? doc.parts.map(part => {
    const type = part['type'] as string, defaults = PART_EN[type] ?? partOf(type)?.en;
    return defaults ? {...defaults, ...part} : part;
  }) : doc.parts;
  list.forEach((part, index) => must(partOf(part['type'])).check(part, `parts[${index}]`, issues));
  checkAnchors(list, issues, partOf);
  if (issues.length) return {doc, bands, issues: capped(issues)};
  list.forEach((part, index) => {
    const at = `parts[${index}]`;
    try {
      const built = must(partOf(part['type'])).build(part, at);
      const roots = cloneData([built].flat());
      markSpecPart(walkDefinedBands(roots as unknown as Band[]), at);
      bands.push(...roots);
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

type PrepareOptions = PartOptions & Pick<RenderOptions, 'captions'>;

type SpecProject = Pick<Config, 'wrap' | 'keepWords' | 'tones' | 'legend' | 'legendLabels' | 'maxWidth' | 'accept' | 'terms'>;

function addLegend(bands: SelectedBand[], doc: SpecDocument, options: PrepareOptions, project?: SpecProject) {
  if ((doc.legend ?? project?.legend) !== 'auto') return;
  const labels = doc.lang === 'en'
    ? {...project?.legendLabels, ...Object.assign({}, ...options.parts.map(part => part.legendEn ?? {})), ...LEGEND_EN}
    : project?.legendLabels;
  if (!options.autoLegend) throw new Error("svg-diagram: legend: 'auto' needs autoLegend from svg-diagram/bands/legend (pass it as the autoLegend option)");
  const legend = options.autoLegend(bands, labels);
  if (legend) bands.push(legend);
}

function prepareSpec(input: unknown, options: PrepareOptions) {
  const {doc, bands, issues} = assemble(input, options);
  if (issues.length) throw new SpecError(issues);
  const connectors = options.parts.find(part => part.connectors)?.connectors;
  const {title, theme, width, appearance, density, showTitle, sourceLine, canvas, lang, desc} = doc;
  return {doc, bands, drawOptions: {captions: options.captions, title, theme, width, appearance, density, showTitle,
    sourceLine, canvas, legend: doc.legend, desc: desc ?? (lang === 'en' ? title : undefined), connectors}};
}

/** Document findings (mid-word breaks, terms, page-level checks) for `renderSpec`: spread into its options to opt in, `renderSpec(spec, {parts, measure, ...specFindings()})`. */
export function specFindings(terms?: SpecProject['terms']): Pick<RenderOptions, 'diagramFindings' | 'diagramAcceptHint'> {
  return {
    diagramFindings: (diagram, stage) => [...midWordFindings(diagram), ...termFindings(diagram.bands, terms), ...documentFindings(diagram, stage)],
    diagramAcceptHint: rule => rule === 'term-variant' || rule === 'term-avoid' || rule === 'text-mid-word-break' ? findingAcceptanceHint(rule) : documentAcceptHint(rule),
  };
}

/** @internal Validate before drawing so Edge can distinguish validation from layout errors. */
function prepareSpecRender(input: unknown, options: PrepareOptions, findings?: ReturnType<typeof specFindings>) {
  const {doc, bands, drawOptions} = prepareSpec(input, options);
  addLegend(bands, doc, options);
  return (measure: RenderOptions['measure']) => renderBands(bands, {...drawOptions, ...findings, measure});
}

/** @internal Include document diagnostics in the Node and Edge spec results. */
export function prepareVerifiedSpecRender(input: unknown, options: PrepareOptions) {
  return prepareSpecRender(input, options, specFindings());
}

/** @internal Provide the prepared geometry and SVG emitter to consumers such as the deck renderer. */
/** `wideWidth`: the deck's own layout width past the spec's 940 (a wide slide room, B6); internal, never part of the options a caller gives. */
export function prepareSpecLayout(input: unknown, options: PrepareOptions & {project?: SpecProject}, wideWidth?: number) {
  const {doc, bands, drawOptions: written} = prepareSpec(input, options);
  const drawOptions = wideWidth === undefined ? written : {...written, width: wideWidth};
  const {wrap, keepWords, tones, accept, terms} = options.project ?? {};
  // a layout the deck widened is not "wider than the text column" (doc-width): the slide has the room
  const maxWidth = wideWidth === undefined ? options.project?.maxWidth : Math.max(wideWidth, options.project?.maxWidth ?? 0);
  addLegend(bands, doc, options, options.project);
  return async (measurement: RenderOptions['measure'] | BatchMeasurement) => {
    const prepared = await prepareBands(bands, {
      ...drawOptions, wrap, keepWords, tones, maxWidth, accept, legend: doc.legend ?? options.project?.legend,
      ...specFindings(terms),
      ...(typeof measurement === 'function' ? {measure: measurement} : measurement),
    });
    const {emit} = prepared;
    return {...prepared, emit(figure: typeof prepared.placed, noRecolor?: boolean) {
      const titled = {...figure, title: oneLine(figure.title)};
      if (figure.desc) return emit(titled, noRecolor, oneLine(figure.desc));
      return emit(titled, noRecolor);
    }};
  };
}

export async function renderSpec(input: unknown, options: PartOptions & Pick<RenderOptions, 'measure' | 'captions' | 'diagramFindings' | 'diagramAcceptHint'>) {
  const {diagramFindings, diagramAcceptHint} = options;
  return prepareSpecRender(input, options, {diagramFindings, diagramAcceptHint})(options.measure);
}
