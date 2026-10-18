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
/** A vendor's icon set (AWS, Azure, ...) installed from files: its licence is the vendor's own terms, which the installer had to say they read. */
export interface IconPack {
  /** where the terms are (a URL, or the file / page name) */
  terms: string;
  /** what was installed from (the directory or zip name) */
  source: string;
  /** ISO date the terms were accepted */
  acceptedAt: string;
}
export interface IconManifest {
  version: 1;
  /** The Iconify set the project's icons mainly come from (`mdi`): `icons find` prefers it so the figure's icons look alike. */
  mainSet?: string;
  /** Vendor icon packs installed from files (add-pack): the terms the person said they read. */
  packs?: Record<string, IconPack>;
  icons: Record<string, InstalledIcon>;
}

export const MANIFEST_FILE = 'svg-diagram.icons.json';
export const ICON_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
/** Licences installed without a flag: no attribution line is needed in the figure itself. Others need --allow-license. */
export const PERMISSIVE: ReadonlySet<string> = new Set(['MIT', 'ISC', 'Apache-2.0', 'CC0-1.0', '0BSD', 'Unlicense', 'BSD-2-Clause', 'BSD-3-Clause']);

export function emptyManifest(): IconManifest {
  return {version: 1, icons: {}};
}

export function parseManifest(text: string, where: string): IconManifest {
  let m: unknown;
  try { m = JSON.parse(text); } catch (e) { throw new Error(`${where}: ${(e as Error).message}`); }
  const o = m as Partial<IconManifest> | null;
  if (!o || o.version !== 1 || typeof o.icons !== 'object' || o.icons === null) throw new Error(`${where}: not an svg-diagram icon file. The smallest valid file is {"version": 1, "icons": {}} (an empty {} is not enough). Write that, or delete the file and let "svg-diagram icons add ..." create it`);
  for (const [k, pk] of Object.entries(o.packs ?? {})) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(k) || typeof pk?.terms !== 'string' || !pk.terms || typeof pk.source !== 'string' || typeof pk.acceptedAt !== 'string') throw new Error(`${where}: bad pack "${k}" (needs terms, source and acceptedAt)`);
  if (o.mainSet !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.mainSet)) throw new Error(`${where}: bad mainSet "${o.mainSet}"`);
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

const CONTAINERS: ReadonlySet<string> = new Set(['g', 'defs', 'linearGradient', 'radialGradient', 'clipPath']);
const LEAVES: ReadonlySet<string> = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'stop']);
const ATTRS: ReadonlySet<string> = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'fx', 'fy', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-opacity', 'stroke-opacity', 'opacity', 'fill-rule', 'clip-rule', 'clip-path', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'clipPathUnits', 'href', 'xlink:href']);
/** What a vendor's .svg carries that means nothing to a drawing (editor and accessibility leftovers): dropped when reading a file, not refused. */
const IGNORED_ATTR = /^(data-|inkscape:|sodipodi:|xml:|xmlns|aria-|role$|focusable$|version$|enable-background$|overflow$|vector-effect$|shape-rendering$)/;
const PAINT: ReadonlySet<string> = new Set(['fill', 'stroke', 'stop-color']);
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_ID = /^[A-Za-z][\w-]*$/;
const REF = /^url\(#([A-Za-z][\w-]*)\)$/;

/** The elements of an .svg file that mean nothing to a drawing, and the XML furniture around the root, removed before the file is read. */
export function cleanSvgFile(svg: string): string {
  return svg
    .replace(/<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, '')
    .replace(/<(title|desc|metadata)\b[\s\S]*?<\/\1>/g, '').replace(/<(sodipodi|inkscape):[^>]*?\/?>/g, '')
    .replace(/(\s[\w:-]+)\s*=\s*'([^'"]*)'/g, '$1="$2"')
    .replace(/="([^"]*)"/g, (_m, v: string) => `="${v.replace(/\s+/g, ' ').trim()}"`);
}

/**
 * An icon body (Iconify's `body`, the inside of an .svg) reduced to what box({icon}) will draw: shapes, groups, and — for the
 * vendor icon sets — gradients and clip paths defined inside the body. A whitelist of attributes; no scripts / styles / text /
 * images / outside references. Paint is `currentColor` / `none` (the tone colour), or #hex colours and gradients when
 * `allowColor`: then the icon is `fixed`. `lenient` drops editor leftovers (data-*, inkscape:*) instead of refusing them.
 * Returns the normalised fragment.
 */
export function sanitizeBody(body: string, what: string, allowColor: boolean, lenient = false): {body: string; fixed: boolean; tags: {name: string; attrs: Map<string, string>; close: boolean}[]} {
  const bad = /<(style|script|text|tspan|image|foreignObject|use|mask|filter|pattern|symbol|marker|animate\w*|set)\b/.exec(body);
  if (bad) throw new Error(`${what}: <${bad[1]}> is not supported (shapes, groups, gradients and clip paths only — no styles, scripts, masks, filters, text, images or references)`);
  const tags: {name: string; attrs: Map<string, string>; close: boolean}[] = [];
  const rest = body.replace(/<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g, (_m, slash: string, name: string, attrs: string, self: string) => {
    tags.push({name, attrs: new Map([...attrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(a => [a[1], a[2]])), close: slash === '/'});
    if (self) tags.push({name, attrs: new Map(), close: true});
    return '';
  });
  if (rest.trim() !== '') throw new Error(`${what}: the icon has something besides shapes (text, comments, scripts or malformed tags)`);
  let fixed = false;
  let depth = 0;
  const defined = new Set<string>(), used = new Set<string>();
  for (const t of tags) {
    if (t.close) continue;
    for (const [k, v] of t.attrs) {
      if (k === 'id' && SAFE_ID.test(v)) defined.add(v);
      const m = REF.exec(v);
      if (m) used.add(m[1]);
      else if ((k === 'href' || k === 'xlink:href') && v.startsWith('#')) used.add(v.slice(1));
    }
  }
  for (const u of used) if (!defined.has(u)) throw new Error(`${what}: refers to #${u}, which the icon does not define (no outside references)`);
  const out: string[] = [];
  for (const t of tags) {
    if (!CONTAINERS.has(t.name) && !LEAVES.has(t.name)) throw new Error(`${what}: <${t.name}> is not supported (shapes, groups, gradients and clip paths only — no styles, masks, filters, text or images)`);
    if (t.close) {
      depth--;
      if (CONTAINERS.has(t.name)) out.push(`</${t.name}>`);
      continue;
    }
    depth++;
    const parts: string[] = [];
    for (const [k, v] of t.attrs) {
      if (lenient && IGNORED_ATTR.test(k)) continue;
      if (!ATTRS.has(k)) throw new Error(`${what}: <${t.name} ${k}="…"> is not supported`);
      if (k === 'id' && !used.has(v)) continue; // an id nothing refers to is only a name: dropped (vendor ids have slashes)
      if (/["<>]|javascript:/i.test(v)) throw new Error(`${what}: ${k} holds something other than plain data`);
      if (/url\(/i.test(v) && !((k === 'fill' || k === 'stroke' || k === 'clip-path') && REF.test(v))) throw new Error(`${what}: ${k}="${v}" — only url(#id) of something inside the icon is supported`);
      if ((k === 'href' || k === 'xlink:href') && !(v.startsWith('#') && SAFE_ID.test(v.slice(1)))) throw new Error(`${what}: ${k}="${v}" — only a reference to something inside the icon is supported`);
      if (k === 'id' && !SAFE_ID.test(v)) throw new Error(`${what}: the id "${v}" is not a plain name`);
      if (PAINT.has(k) && v !== 'currentColor' && v !== 'none') {
        if (!REF.test(v) && !HEX.test(v)) throw new Error(`${what}: ${k}="${v}" — only currentColor, none, #hex colours and gradients of the icon are supported (no named colours)`);
        if (!allowColor) throw new Error(`${what}: the icon has colours of its own (${k}="${v}") that would not follow the tone or the dark theme. To install it anyway: --color`);
        fixed = true;
      }
      parts.push(`${k}="${v}"`);
    }
    out.push(`<${t.name}${parts.length ? ' ' + parts.join(' ') : ''}${CONTAINERS.has(t.name) ? '>' : '/>'}`);
  }
  if (depth !== 0 || tags.length === 0) throw new Error(`${what}: the icon's tags do not nest properly`);
  return {body: out.join(''), fixed, tags};
}

/** The body with every id (and what refers to it) given a prefix — so two icons, or one icon used twice, never share an id in one SVG. */
export function prefixIds(body: string, prefix: string): string {
  return body.replace(/\bid="([^"]+)"/g, (_m, id: string) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, id: string) => `url(#${prefix}${id})`)
    .replace(/\bhref="#([^"]+)"/g, (_m, id: string) => `href="#${prefix}${id}"`);
}

/**
 * The glyph of an icon body with its box size. A body that is exactly one filled <path> keeps the compact `d` form; anything
 * else (line icons, several parts, colours) is kept as a sanitized fragment — see IconGlyph. Throws, with the reason, on what
 * box({icon}) cannot draw, so a bad pick is found at install time and not in a figure.
 */
export function glyphFromBody(body: string, box: {width?: number | string; height?: number | string; left?: number; top?: number}, what: string, opts: {color?: boolean; lenient?: boolean} = {}): IconGlyph {
  const w = num(box.width) ?? 16, h = num(box.height) ?? w;
  // a wide / tall icon (most logos) is centred in a square viewBox: box({icon}) reserves a square
  const side = Math.max(w, h);
  const vb: [number, number, number] = [(box.left ?? 0) - (side - w) / 2, (box.top ?? 0) - (side - h) / 2, side];
  const clean = sanitizeBody(body, what, opts.color === true, opts.lenient === true);
  const only = clean.tags.length === 2 && clean.tags[0].name === 'path' ? clean.tags[0].attrs : undefined;
  if (only && [...only.keys()].every(k => k === 'd' || k === 'fill' || k === 'fill-rule' || k === 'clip-rule') && only.get('d') && only.get('fill') !== 'none' && !clean.fixed) {
    return {d: only.get('d')!, vb, ...(only.get('fill-rule') === 'evenodd' ? {rule: 'evenodd' as const} : {})};
  }
  return {body: clean.body, vb, ...(clean.fixed ? {fixed: true as const} : {})};
}

/** The glyph of a standalone .svg file (its viewBox, or width and height; editor leftovers are dropped). */
export function glyphFromSvg(svg: string, what: string, opts: {color?: boolean} = {}): IconGlyph {
  const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(cleanSvgFile(svg));
  if (!root) throw new Error(`${what}: not an <svg> file`);
  const attr = (n: string) => new RegExp(`\\s${n}\\s*=\\s*"([^"]+)"`).exec(root[1])?.[1];
  let vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || !vb.every(Number.isFinite)) {
    const w = num(attr('width')), h = num(attr('height'));
    if (!w || !h) throw new Error(`${what}: needs a viewBox`);
    vb = [0, 0, w, h];
  }
  return glyphFromBody(root[2], {width: vb[2], height: vb[3], left: vb[0], top: vb[1]}, what, {...opts, lenient: true});
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

/**
 * The icon name for a file of a vendor pack: the file name without its numbering, "Arch_" / "icon-service-" decoration and size
 * suffix, in kebab case under the pack's prefix — `Arch_AWS-Lambda_48.svg` → `aws-lambda` for prefix `aws` (the prefix is not
 * repeated when the name already starts with it).
 */
export function packIconName(file: string, prefix: string): string {
  let n = file.split('/').pop()!.replace(/\.svg$/i, '');
  n = n.replace(/^\d+[-_ ]/, '').replace(/^(icon-service|icon|arch(-category)?|res|resource)[-_ ]/i, '').replace(/^(icon-service|icon)[-_ ]/i, '');
  n = n.replace(/[-_ ]\d{2,3}(px)?([-_ ].*)?$/, (m, _a, rest: string | undefined) => (rest ? `-${rest.slice(1)}` : ''));
  n = n.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  if (n === prefix || n.startsWith(prefix + '-')) return n;
  return `${prefix}-${n}`;
}
