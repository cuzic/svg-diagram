// A small SVG reader for the checks on a rendering (lib/svg-lint.ts): the element tree, the cascade (presentation attributes, a
// <style> block's simple selectors, style=""), colours and transforms. It covers what this tool emits and what a hand-written
// diagram plausibly uses; it is not a CSS engine.

export interface El {tag: string; attrs: Record<string, string>; children: (El | string)[]; parent: El | null; order: number}

const ENT: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const decode = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);

/** Parses well-formed XML (xmlProblems() says whether it is) into a tree; returns the root element. Throws on what it cannot read. */
export function parseXml(src: string): El {
  const svg = parseXmlFragment(src).children.find((c): c is El => typeof c !== 'string' && c.tag === 'svg');
  if (!svg) throw new Error('no <svg> element');
  svg.parent = null;
  return svg;
}

/** Parses a well-formed XML fragment — several top-level elements and text, like the HTML of `build --html` — into a '#document' node. */
export function parseXmlFragment(src: string): El {
  let i = 0, order = 0;
  const root: El = {tag: '#document', attrs: {}, children: [], parent: null, order: order++};
  let cur = root;
  const ATTR = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const textEnd = lt === -1 ? src.length : lt;
    if (textEnd > i) cur.children.push(decode(src.slice(i, textEnd)));
    if (lt === -1) break;
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); if (e === -1) throw new Error('an unterminated comment'); i = e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt); if (e === -1) throw new Error('an unterminated CDATA section'); cur.children.push(src.slice(lt + 9, e)); i = e + 3; continue; }
    if (src.startsWith('<?', lt) || src.startsWith('<!', lt)) { const e = src.indexOf('>', lt); if (e === -1) throw new Error('an unterminated declaration'); i = e + 1; continue; }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt);
      if (e === -1) throw new Error('a malformed closing tag');
      if (!cur.parent) throw new Error(`</${src.slice(lt + 2, e).trim()}> closes nothing`);
      cur = cur.parent; i = e + 1; continue;
    }
    const nm = /[^\s/>]+/y; nm.lastIndex = lt + 1;
    const name = nm.exec(src);
    if (!name) throw new Error('a "<" that starts no tag');
    const el: El = {tag: name[0], attrs: {}, children: [], parent: cur, order: order++};
    let p = lt + 1 + name[0].length;
    for (;;) { ATTR.lastIndex = p; const a = ATTR.exec(src); if (!a) break; el.attrs[a[1]] = decode(a[2] ?? a[3]); p += a[0].length; }
    const tail = /\s*(\/?)>/y; tail.lastIndex = p;
    const t = tail.exec(src);
    if (!t) throw new Error(`<${name[0]}> has an attribute without a quoted value`);
    cur.children.push(el);
    if (!t[1]) cur = el;
    i = p + t[0].length;
  }
  if (cur !== root) throw new Error(`<${cur.tag}> is never closed`);
  return root;
}

export const elements = (el: El): El[] => [el, ...el.children.flatMap(c => typeof c === 'string' ? [] : elements(c))];
export const textOf = (el: El): string => el.children.map(c => typeof c === 'string' ? c : textOf(c)).join('');
/**
 * The text of a <text> grouped by the colour it is drawn in (a tspan with its own fill is a group of its own; a tspan that
 * inherits the colour, an emoji's, joins the text's). A <text> drawn in one colour is one group. In order of first appearance.
 */
export function colourGroups(text: El, styles: Map<El, Style>): {style: Style; txt: string}[] {
  const groups = new Map<string, {style: Style; txt: string}>();
  const walk = (e: El) => {
    for (const c of e.children) {
      if (typeof c !== 'string') { walk(c); continue; }
      const style = styles.get(e)!, g = groups.get(style.fill) ?? {style, txt: ''};
      g.txt += c;
      groups.set(style.fill, g);
    }
  };
  walk(text);
  return [...groups.values()].filter(g => g.txt.trim());
}
export const closest = (el: El | null, test: (e: El) => boolean): El | null => { for (let e = el; e; e = e.parent) if (test(e)) return e; return null; };

// ---- colours ----

export interface RGBA {r: number; g: number; b: number; a: number}
const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], gray: [128, 128, 128],
  grey: [128, 128, 128], orange: [255, 165, 0], purple: [128, 0, 128], navy: [0, 0, 128], teal: [0, 128, 128], silver: [192, 192, 192], maroon: [128, 0, 0],
  lime: [0, 255, 0], aqua: [0, 255, 255], cyan: [0, 255, 255], fuchsia: [255, 0, 255], magenta: [255, 0, 255], olive: [128, 128, 0], pink: [255, 192, 203],
  brown: [165, 42, 42], lightgray: [211, 211, 211], lightgrey: [211, 211, 211], darkgray: [169, 169, 169], darkgrey: [169, 169, 169],
};

/** The colour a paint value stands for; null for none, a url() reference, or anything not understood (as a computed style that is not rgb()). */
export function parseColor(value: string, current?: string): RGBA | null {
  const v = value.trim().toLowerCase();
  if (v === 'currentcolor') return current !== undefined ? parseColor(current) : {r: 0, g: 0, b: 0, a: 1};
  if (v === 'transparent') return {r: 0, g: 0, b: 0, a: 0};
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return {r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1};
    if (h.length === 6 || h.length === 8) return {r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1};
    return null;
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const ch = (s: string) => s.endsWith('%') ? parseFloat(s) * 255 / 100 : parseFloat(s);
    return {r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a: m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])};
  }
  const n = NAMED[v];
  return n ? {r: n[0], g: n[1], b: n[2], a: 1} : null;
}

// ---- transforms: [a b c d e f], x' = a x + c y + e, y' = b x + d y + f ----

export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export function parseTransform(value: string | undefined): Matrix {
  let m = IDENTITY;
  if (!value) return m;
  for (const t of value.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    const rad = (d: number) => d * Math.PI / 180;
    let n: Matrix | null = null;
    switch (t[1]) {
      case 'translate': n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const c = Math.cos(rad(a[0] ?? 0)), s = Math.sin(rad(a[0] ?? 0)), cx = a[1] ?? 0, cy = a[2] ?? 0;
        n = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
        break;
      }
      case 'skewX': n = [1, 0, Math.tan(rad(a[0] ?? 0)), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan(rad(a[0] ?? 0)), 0, 1, 0, 0]; break;
      case 'matrix': if (a.length === 6) n = a as Matrix; break;
    }
    if (n && n.every(Number.isFinite)) m = multiply(m, n);
  }
  return m;
}

// ---- the cascade ----

export interface Style {
  fill: string; stroke: string; strokeWidth: number; opacity: number; fillOpacity: number; strokeOpacity: number;
  fontSize: number; fontWeight: number; fontFamily: string; textAnchor: string; color: string;
}
const INITIAL: Style = {fill: 'black', stroke: 'none', strokeWidth: 1, opacity: 1, fillOpacity: 1, strokeOpacity: 1, fontSize: 16, fontWeight: 400, fontFamily: 'serif', textAnchor: 'start', color: 'black'};
const PROPS: Record<string, keyof Style> = {
  'fill': 'fill', 'stroke': 'stroke', 'stroke-width': 'strokeWidth', 'opacity': 'opacity', 'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity',
  'font-size': 'fontSize', 'font-weight': 'fontWeight', 'font-family': 'fontFamily', 'text-anchor': 'textAnchor', 'color': 'color',
};

interface Rule {sel: (e: El) => boolean; specificity: number; order: number; decls: Record<string, string>}

function compound(sel: string): {test: (e: El) => boolean; spec: number} | null {
  const m = /^(\*|[a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(sel);
  if (!m) return null;
  const tag = m[1] && m[1] !== '*' ? m[1] : null;
  const parts = [...m[2].matchAll(/([.#])([\w-]+)/g)].map(x => [x[1], x[2]] as const);
  return {
    spec: (tag ? 1 : 0) + parts.filter(p => p[0] === '.').length * 10 + parts.filter(p => p[0] === '#').length * 100,
    test: e => (!tag || e.tag === tag) && parts.every(([k, v]) => k === '.' ? (e.attrs.class ?? '').split(/\s+/).includes(v) : e.attrs.id === v),
  };
}

function rulesOf(root: El): Rule[] {
  const rules: Rule[] = [];
  let order = 0;
  for (const st of elements(root).filter(e => e.tag === 'style')) {
    const css = textOf(st).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const r of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const decls: Record<string, string> = {};
      for (const d of r[2].split(';')) { const i = d.indexOf(':'); if (i > 0) decls[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim().replace(/\s*!important$/, ''); }
      for (const selText of r[1].split(',')) {
        const chain = selText.trim().split(/\s+/).map(compound);
        if (!chain.length || chain.some(c => !c)) continue;
        const last = chain[chain.length - 1]!;
        const ancestors = chain.slice(0, -1) as NonNullable<(typeof chain)[number]>[];
        rules.push({
          specificity: chain.reduce((s, c) => s + c!.spec, 0), order: order++, decls,
          sel: e => last.test(e) && (() => { let a = e.parent, i = ancestors.length - 1; while (a && i >= 0) { if (ancestors[i].test(a)) i--; a = a.parent; } return i < 0; })(),
        });
      }
    }
  }
  return rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
}

function length(v: string, parent: number, fallback: number): number {
  const m = /^\s*(-?[\d.]+)(px|pt|em|rem|%)?\s*$/.exec(v);
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  return m[2] === 'em' ? n * parent : m[2] === 'rem' ? n * 16 : m[2] === '%' ? n * parent / 100 : m[2] === 'pt' ? n * 4 / 3 : n;
}

function setProp(s: Style, parent: Style, name: string, value: string) {
  const key = PROPS[name];
  if (!key) return;
  switch (key) {
    case 'strokeWidth': s.strokeWidth = length(value, parent.strokeWidth, s.strokeWidth); break;
    case 'fontSize': s.fontSize = length(value, parent.fontSize, s.fontSize); break;
    case 'opacity': case 'fillOpacity': case 'strokeOpacity': { const n = parseFloat(value); if (Number.isFinite(n)) s[key] = value.trim().endsWith('%') ? n / 100 : n; break; }
    case 'fontWeight': s.fontWeight = value === 'bold' ? 700 : value === 'normal' ? 400 : value === 'bolder' ? Math.min(900, parent.fontWeight + 300) : value === 'lighter' ? Math.max(100, parent.fontWeight - 300) : Number(value) || s.fontWeight; break;
    default: (s[key] as string) = value.trim();
  }
}

/** The computed style of every element (the properties lint reads), by the rules of presentation attributes < <style> rules < style="". */
export function computeStyles(root: El): Map<El, Style> {
  const rules = rulesOf(root);
  const out = new Map<El, Style>();
  const walk = (el: El, parent: Style) => {
    const s: Style = {...parent, opacity: 1}; // opacity is not inherited
    for (const [name, value] of Object.entries(el.attrs)) setProp(s, parent, name, value);
    for (const r of rules) if (r.sel(el)) for (const [name, value] of Object.entries(r.decls)) setProp(s, parent, name, value);
    for (const d of (el.attrs.style ?? '').split(';')) { const i = d.indexOf(':'); if (i > 0) setProp(s, parent, d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()); }
    out.set(el, s);
    for (const c of el.children) if (typeof c !== 'string') walk(c, s);
  };
  walk(root, INITIAL);
  return out;
}
