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
export declare const MANIFEST_FILE = "svg-diagram.icons.json";
export declare const ICON_NAME_RE: RegExp;
/** Licences installed without a flag: no attribution line is needed in the figure itself. Others need --allow-license. */
export declare const PERMISSIVE: ReadonlySet<string>;
export declare function emptyManifest(): IconManifest;
export declare function parseManifest(text: string, where: string): IconManifest;
/** The elements of an .svg file that mean nothing to a drawing, and the XML furniture around the root, removed before the file is read. */
export declare function cleanSvgFile(svg: string): string;
/**
 * An icon body (Iconify's `body`, the inside of an .svg) reduced to what box({icon}) will draw: shapes, groups, and — for the
 * vendor icon sets — gradients and clip paths defined inside the body. A whitelist of attributes; no scripts / styles / text /
 * images / outside references. Paint is `currentColor` / `none` (the tone colour), or #hex colours and gradients when
 * `allowColor`: then the icon is `fixed`. `lenient` drops editor leftovers (data-*, inkscape:*) instead of refusing them.
 * Returns the normalised fragment.
 */
export declare function sanitizeBody(body: string, what: string, allowColor: boolean, lenient?: boolean): {
    body: string;
    fixed: boolean;
    tags: {
        name: string;
        attrs: Map<string, string>;
        close: boolean;
    }[];
};
/** The body with every id (and what refers to it) given a prefix — so two icons, or one icon used twice, never share an id in one SVG. */
export declare function prefixIds(body: string, prefix: string): string;
/**
 * The glyph of an icon body with its box size. A body that is exactly one filled <path> keeps the compact `d` form; anything
 * else (line icons, several parts, colours) is kept as a sanitized fragment — see IconGlyph. Throws, with the reason, on what
 * box({icon}) cannot draw, so a bad pick is found at install time and not in a figure.
 */
export declare function glyphFromBody(body: string, box: {
    width?: number | string;
    height?: number | string;
    left?: number;
    top?: number;
}, what: string, opts?: {
    color?: boolean;
    lenient?: boolean;
}): IconGlyph;
/** The glyph of a standalone .svg file (its viewBox, or width and height; editor leftovers are dropped). */
export declare function glyphFromSvg(svg: string, what: string, opts?: {
    color?: boolean;
}): IconGlyph;
/** `mdi:key-variant=key` → {set, icon, name}; `./logo.svg` → {file, name}. */
export type IconSpec = {
    kind: 'iconify';
    prefix: string;
    icon: string;
    name: string;
} | {
    kind: 'file';
    path: string;
    name: string;
};
export declare function parseSpec(arg: string): IconSpec;
/**
 * The icon name for a file of a vendor pack: the file name without its numbering, "Arch_" / "icon-service-" decoration and size
 * suffix, in kebab case under the pack's prefix — `Arch_AWS-Lambda_48.svg` → `aws-lambda` for prefix `aws` (the prefix is not
 * repeated when the name already starts with it).
 */
export declare function packIconName(file: string, prefix: string): string;
