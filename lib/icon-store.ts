// The project's installed icons (svg-diagram.icons.json) — the pure part: the file's shape, and turning an Iconify / .svg body
// into one filled path. No I/O here (icons.ts reads the file, manage-icons.ts installs into it). svg-diagram ships no icons:
// each project installs the ones it uses with `svg-diagram icons add`, so every icon's licence travels with the project.

/**
 * One installed icon, in a square viewBox [minX, minY, size]. Two forms:
 *   - `d` (+ `rule`): a single filled path, drawn in the tone colour — most of the filled sets (mdi, material-symbols, ...).
 *   - `body`: a few shapes (path / circle / rect / line / polyline / polygon, in <g>) as an SVG fragment, kept as the set drew
 *     them: line icons (lucide, tabler, ...) draw with stroke="currentColor", and `currentColor` is the tone colour. With
 *     `fixed`, the body has colours of its own (a colour icon or logo): they do not follow the tone or the dark theme.
 */
export interface IconGlyph {
  vb: [number, number, number];
  d?: string;
  /** fill-rule, only when the source says evenodd */
  rule?: 'evenodd';
  body?: string;
  fixed?: true;
}
export interface InstalledIcon extends IconGlyph {
  /** Where it came from: `mdi:key-variant` (Iconify) or `file:logo.svg` */
  from: string;
  /** SPDX id of its licence (`local` for a file the project drew itself) */
  license: string;
  licenseUrl?: string;
  author?: string;
}
export interface IconManifest {
  version: 1;
  icons: Record<string, InstalledIcon>;
}

export const MANIFEST_FILE = 'svg-diagram.icons.json';
export const ICON_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
/** Licences installed without a flag: no attribution line is needed in the figure itself. Others need --allow-license. */
export const PERMISSIVE = new Set(['MIT', 'ISC', 'Apache-2.0', 'CC0-1.0', '0BSD', 'Unlicense', 'BSD-2-Clause', 'BSD-3-Clause']);

export function emptyManifest(): IconManifest {
  return {version: 1, icons: {}};
}

export function parseManifest(text: string, where: string): IconManifest {
  let m: unknown;
  try { m = JSON.parse(text); } catch (e) { throw new Error(`${where}: ${(e as Error).message}`); }
  const o = m as Partial<IconManifest> | null;
  if (!o || o.version !== 1 || typeof o.icons !== 'object' || o.icons === null) throw new Error(`${where}: not an svg-diagram icon file (expected {"version": 1, "icons": {...}})`);
  for (const [name, ic] of Object.entries(o.icons)) {
    if (!ICON_NAME_RE.test(name)) throw new Error(`${where}: bad icon name "${name}"`);
    const shape = typeof ic?.d === 'string' ? ic.d : typeof ic?.body === 'string' ? ic.body : '';
    const ok = shape.length > 0 && Array.isArray(ic.vb) && ic.vb.length === 3 && ic.vb.every(Number.isFinite) && ic.vb[2] > 0;
    if (!ok || (ic.d !== undefined && /["<>]/.test(ic.d))) throw new Error(`${where}: icon "${name}" has no usable path / viewBox`);
    // the file is committed and hand-editable: a body is checked again against the same whitelist the installer applies
    if (ic.body !== undefined) {
      const b = sanitizeBody(ic.body, `${where}: icon "${name}"`, ic.fixed === true);
      if (b.fixed !== (ic.fixed === true)) throw new Error(`${where}: icon "${name}" ${ic.fixed ? 'says fixed but has no colours of its own' : 'has colours of its own but is not marked fixed'}`);
    }
  }
  return o as IconManifest;
}

/** Normalise a numeric/“24” size attribute. */
const num = (v: string | number | undefined): number | undefined => (v === undefined || v === '' ? undefined : Number.parseFloat(String(v)));

const SHAPES = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'clip-rule']);
const PAINT = new Set(['fill', 'stroke']);
const HEX = /^#[0-9a-fA-F]{3,8}$/;

/**
 * An icon body (Iconify's `body`, the inside of an .svg) reduced to what box({icon}) will draw: shapes and groups, a whitelist of
 * attributes, no scripts / styles / references. Paint is `currentColor` / `none` (the tone colour) — or hex colours, only when
 * `allowColor`: then the icon is `fixed`. Returns the normalised fragment.
 */
export function sanitizeBody(body: string, what: string, allowColor: boolean): {body: string; fixed: boolean; tags: {name: string; attrs: Map<string, string>; close: boolean}[]} {
  const tags: {name: string; attrs: Map<string, string>; close: boolean}[] = [];
  const rest = body.replace(/<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g, (_m, slash: string, name: string, attrs: string, self: string) => {
    tags.push({name, attrs: new Map([...attrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(a => [a[1], a[2]])), close: slash === '/'});
    if (self) tags.push({name, attrs: new Map(), close: true});
    return '';
  });
  if (rest.trim() !== '') throw new Error(`${what}: the icon has something besides shapes (text, comments, scripts or malformed tags)`);
  let fixed = false;
  let depth = 0;
  const out: string[] = [];
  for (const t of tags) {
    if (!SHAPES.has(t.name)) throw new Error(`${what}: <${t.name}> is not supported (shapes only: ${[...SHAPES].join(', ')} — no gradients, masks, clip paths, text or images)`);
    if (t.close) { depth--; if (t.name === 'g') out.push('</g>'); else if (!out[out.length - 1]?.endsWith('/>')) out.push(`</${t.name}>`); continue; }
    depth++;
    const parts: string[] = [];
    for (const [k, v] of t.attrs) {
      if (!ATTRS.has(k)) throw new Error(`${what}: <${t.name} ${k}="…"> is not supported`);
      if (/["<>]|url\(|javascript:/i.test(v)) throw new Error(`${what}: ${k} holds something other than plain data`);
      if (PAINT.has(k) && v !== 'currentColor' && v !== 'none') {
        if (!HEX.test(v)) throw new Error(`${what}: ${k}="${v}" — only currentColor, none and #hex colours are supported (no gradients or named colours)`);
        if (!allowColor) throw new Error(`${what}: the icon has colours of its own (${k}="${v}") that would not follow the tone or the dark theme. To install it anyway: --color`);
        fixed = true;
      }
      parts.push(`${k}="${v}"`);
    }
    out.push(`<${t.name}${parts.length ? ' ' + parts.join(' ') : ''}${t.name === 'g' ? '>' : '/>'}`);
  }
  if (depth !== 0 || tags.length === 0) throw new Error(`${what}: the icon's tags do not nest properly`);
  return {body: out.join(''), fixed, tags};
}

/**
 * The glyph of an icon body with its box size. A body that is exactly one filled <path> keeps the compact `d` form; anything
 * else (line icons, several parts, colours) is kept as a sanitized fragment — see IconGlyph. Throws, with the reason, on what
 * box({icon}) cannot draw, so a bad pick is found at install time and not in a figure.
 */
export function glyphFromBody(body: string, box: {width?: number | string; height?: number | string; left?: number; top?: number}, what: string, opts: {color?: boolean} = {}): IconGlyph {
  const w = num(box.width) ?? 16, h = num(box.height) ?? w;
  // a wide / tall icon (most logos) is centred in a square viewBox: box({icon}) reserves a square
  const side = Math.max(w, h);
  const vb: [number, number, number] = [(box.left ?? 0) - (side - w) / 2, (box.top ?? 0) - (side - h) / 2, side];
  const clean = sanitizeBody(body, what, opts.color === true);
  const only = clean.tags.length === 2 && clean.tags[0].name === 'path' ? clean.tags[0].attrs : undefined;
  if (only && [...only.keys()].every(k => k === 'd' || k === 'fill' || k === 'fill-rule' || k === 'clip-rule') && only.get('d') && only.get('fill') !== 'none' && !clean.fixed) {
    return {d: only.get('d')!, vb, ...(only.get('fill-rule') === 'evenodd' ? {rule: 'evenodd' as const} : {})};
  }
  return {body: clean.body, vb, ...(clean.fixed ? {fixed: true as const} : {})};
}

/** The glyph of a standalone .svg file (single <path>, a square viewBox). */
export function glyphFromSvg(svg: string, what: string, opts: {color?: boolean} = {}): IconGlyph {
  const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(svg);
  if (!root) throw new Error(`${what}: not an <svg> file`);
  const vb = /viewBox\s*=\s*"([^"]+)"/.exec(root[1])?.[1].trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || !vb.every(Number.isFinite)) throw new Error(`${what}: needs a viewBox`);
  const body = root[2].replace(/<(title|desc)\b[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  return glyphFromBody(body, {width: vb[2], height: vb[3], left: vb[0], top: vb[1]}, what, opts);
}

/** `mdi:key-variant=key` → {set, icon, name}; `./logo.svg` → {file, name}. */
export type IconSpec = {kind: 'iconify'; prefix: string; icon: string; name: string} | {kind: 'file'; path: string; name: string};
export function parseSpec(arg: string): IconSpec {
  const eq = arg.lastIndexOf('=');
  const [src, as] = eq > 0 ? [arg.slice(0, eq), arg.slice(eq + 1)] : [arg, undefined];
  if (/\.svg$/i.test(src)) {
    const base = src.split('/').pop()!.replace(/\.svg$/i, '');
    return finish({kind: 'file', path: src, name: as ?? base});
  }
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(src);
  if (!m) throw new Error(`"${arg}": write an Iconify id like mdi:key-variant (optionally =name), or a path to an .svg file`);
  return finish({kind: 'iconify', prefix: m[1], icon: m[2], name: as ?? m[2]});
}
function finish<S extends IconSpec>(s: S): S {
  if (!ICON_NAME_RE.test(s.name)) throw new Error(`"${s.name}" is not a usable icon name (letters, digits, - and _; starting with a letter) — give one with =name`);
  return s;
}
