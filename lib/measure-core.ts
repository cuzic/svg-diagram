import {splitAtoms} from './atoms.ts';
import {styledAtoms, textRuns} from './layout-text.ts';
import {TAG_SIZE} from './tokens.ts';
import type {DiagramData, FontFamily, MeasureRequest, Measured, Roles, WidthOf} from './types/core.ts';
import type {Band} from './types/index.ts';

export type Requests = Map<string, MeasureRequest>;
type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;

/** What a measure handler registers through: single atoms, a band's own text runs, and (for a band that holds bands) its children. */
export interface MeasureCtx {
  readonly roles: Roles;
  /** Every atom of `text` at this size / weight / font. */
  atoms(text: string, size: number, weight: number, font?: FontFamily): void;
  /** A band's tag, stamp and text runs (what a caption / box / banner needs). */
  own(band: Band): void;
  /** A child band, by its own handler. */
  band(band: Band): void;
}

export type MeasureHandler<B> = (band: B, m: MeasureCtx) => void;
export type MeasureHandlerTable = {[T in Band['type']]: MeasureHandler<BandOf<T>>};

function registerAtoms(requests: Requests, text: string, size: number, weight: number, font: FontFamily = 'sans'): void {
  for (const atom of splitAtoms(text)) {
    const key = `${atom} ${size} ${weight} ${font}`;
    if (!requests.has(key)) requests.set(key, {text: atom, size, weight, font});
  }
}

function registerRequests(requests: Requests, band: Band, roles: Roles): void {
  if ('tag' in band && band.tag) registerAtoms(requests, band.tag, (roles.tag ?? TAG_SIZE), 700);
  if ('stamp' in band && band.stamp) registerAtoms(requests, band.stamp, roles.note, 400);
  for (const run of textRuns(band, roles)) {
    const font = run.mono ? 'mono' : 'sans';
    // a value that may shrink (ADR 0024) is measured at every whole size it may be drawn at: a width is only looked up, never scaled
    for (let size = run.fit && run.nowrap ? run.fit.min : run.size; size <= run.size; size++) {
      for (const {text, weight} of styledAtoms(run)) {
        const key = `${text} ${size} ${weight} ${font}`;
        if (!requests.has(key)) requests.set(key, {text, size, weight, font});
      }
    }
  }
}

/** Pass 1: every atom this diagram needs measured, at the font sizes of `roles`. */
export function createMeasureCollector(resolve: (band: Band) => MeasureHandler<never>, decorate?: (data: DiagramData) => DiagramData) {
  return function collectMeasures(data: DiagramData, roles: Roles): Requests {
    const d = decorate?.(data) ?? data;
    const requests: Requests = new Map();
    const m: MeasureCtx = {
      roles,
      atoms: (text, size, weight, font) => registerAtoms(requests, text, size, weight, font),
      own: band => registerRequests(requests, band, roles),
      band: band => resolve(band)(band as never, m),
    };
    for (const band of d.bands) m.band(band);
    return requests;
  };
}

/**
 * The width lookup over what measureAll(collectMeasures(...)) returned. An atom that was never registered measures 0 wide,
 * silently (a line then overflows its box); with `strict` that is an error. The caller reads SVG_DIAGRAM_STRICT_WIDTH
 * (layout itself touches no environment).
 */
export function widthOfMeasured(measured: Map<string, Measured>, strict: boolean): WidthOf {
  return (atom, size, weight, font) => {
    const m = measured.get(`${atom} ${size} ${weight} ${font}`);
    if (m) return m.w;
    if (strict) throw new Error(`layout: "${atom}" (${size}px, ${weight}, ${font}) was not registered for measuring, so its width would be 0 (SVG_DIAGRAM_STRICT_WIDTH is set)`);
    return 0;
  };
}
