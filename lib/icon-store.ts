// The project's installed icons (svg-diagram.icons.json) — the pure part: the file's shape, and turning an Iconify / .svg body
// into one filled path. No I/O here (icons.ts reads the file, manage-icons.ts installs into it). svg-diagram ships no icons:
// each project installs the ones it uses with `svg-diagram icons add`, so every icon's licence travels with the project.

/** One installed icon: a single filled path in a square viewBox [minX, minY, size]. */
export interface IconGlyph {
  d: string;
  vb: [number, number, number];
  /** fill-rule, only when the source says evenodd */
  rule?: 'evenodd';
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
    const ok = typeof ic?.d === 'string' && ic.d.length > 0 && Array.isArray(ic.vb) && ic.vb.length === 3 && ic.vb.every(Number.isFinite) && ic.vb[2] > 0;
    if (!ok || /["<>]/.test(ic.d)) throw new Error(`${where}: icon "${name}" has no usable path / viewBox`);
  }
  return o as IconManifest;
}

/** Normalise a numeric/“24” size attribute. */
const num = (v: string | number | undefined): number | undefined => (v === undefined || v === '' ? undefined : Number.parseFloat(String(v)));

/**
 * The glyph of an icon body (Iconify's `body`, or the inside of an .svg) with its box size. Only a body that is exactly one
 * <path> drawn as a fill (currentColor / none attributes aside) can be drawn by box({icon}) in a tone colour: stroke-based or
 * multi-part icons throw with the reason, so a bad pick is found at install time and not in a figure.
 */
export function glyphFromBody(body: string, box: {width?: number | string; height?: number | string; left?: number; top?: number}, what: string): IconGlyph {
  const tags = [...body.matchAll(/<(\/?[A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)];
  const names = tags.map(t => t[1]);
  const paths = tags.filter(t => t[1] === 'path');
  if (paths.length !== 1 || names.some(n => n !== 'path' && n !== '/path')) {
    throw new Error(`${what}: ${paths.length === 0 ? 'no <path>' : 'made of several parts or wrapped in a group (stroke-based sets such as lucide / tabler do this)'} — only a single filled path can be drawn in a tone colour (try another set, e.g. mdi, material-symbols, ph-fill, heroicons-solid)`);
  }
  const attrs = new Map([...paths[0][2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(a => [a[1], a[2]]));
  const d = attrs.get('d');
  if (!d) throw new Error(`${what}: the <path> has no d`);
  for (const [k, v] of attrs) {
    const fine = k === 'd' || (k === 'fill' && (v === 'currentColor' || v === '#000' || v === '#000000' || v === 'black')) || k === 'fill-rule' || k === 'clip-rule';
    if (!fine) throw new Error(`${what}: the <path> uses ${k}="${v}" — stroke-based or styled icons cannot take a tone colour (try a filled set: mdi, material-symbols, ph-fill, heroicons-solid)`);
  }
  if (/["<>]/.test(d)) throw new Error(`${what}: the path data is not plain`);
  const w = num(box.width) ?? 16, h = num(box.height) ?? w;
  if (w !== h) throw new Error(`${what}: the icon is ${w}x${h}, not square`);
  const rule = attrs.get('fill-rule') === 'evenodd' ? ({rule: 'evenodd'} as const) : {};
  return {d, vb: [box.left ?? 0, box.top ?? 0, w], ...rule};
}

/** The glyph of a standalone .svg file (single <path>, a square viewBox). */
export function glyphFromSvg(svg: string, what: string): IconGlyph {
  const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(svg);
  if (!root) throw new Error(`${what}: not an <svg> file`);
  const vb = /viewBox\s*=\s*"([^"]+)"/.exec(root[1])?.[1].trim().split(/[\s,]+/).map(Number);
  if (!vb || vb.length !== 4 || !vb.every(Number.isFinite)) throw new Error(`${what}: needs a viewBox`);
  const body = root[2].replace(/<(title|desc)\b[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  return glyphFromBody(body, {width: vb[2], height: vb[3], left: vb[0], top: vb[1]}, what);
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
