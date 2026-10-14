// `svg-diagram icons find <word>...` — from a wanted icon to installable candidates: search Iconify, drop the sets whose licence or
// colours the project has not accepted, drop the icons box({icon}) cannot draw, and put the project's main set first so the icons
// of one figure look alike. Nothing is written; the output says which `icons add` line to run. The words are English (Iconify's
// search is): turning 「鍵」 into `key` is the caller's job (the svg-diagram skill says so).
import {getJson, DEFAULT_API} from './icon-install.ts';
import type {CollectionInfo, Fetch, IconifySet, InstallOpts} from './icon-install.ts';
import {glyphFromBody, PERMISSIVE} from './icon-store.ts';
import type {IconGlyph} from './icon-store.ts';

import {must} from './must.ts';
export type IconStyle = 'fill' | 'line' | 'color';
export interface Candidate {
  id: string;
  prefix: string;
  name: string;
  style: IconStyle;
  license: string;
  mainSet: boolean;
  glyph: IconGlyph;
  /** the `icons add` argument for it, named after the wanted word */
  add: string;
}
export interface FindOpts extends InstallOpts {
  /** only these sets */
  sets?: string[];
  /** only this look; `any` (default) takes all */
  style?: IconStyle | 'any';
  mainSet?: string;
  /** candidates kept per word (default 6) */
  limit?: number;
}

export function styleOf(g: IconGlyph): IconStyle {
  if (g.fixed) return 'color';
  return g.body !== undefined && /stroke="currentColor"/.test(g.body) && !/fill="currentColor"/.test(g.body) ? 'line' : 'fill';
}

const NAME_OK = /^[A-Za-z][A-Za-z0-9_-]*$/;
const splitId = (id: string): [string, string] => { const [prefix = '', name = ''] = id.split(':'); return [prefix, name]; }; // an iconify id is `prefix:name`

export async function findIcons(words: string[], opts: FindOpts = {}): Promise<{word: string; candidates: Candidate[]; skipped: string[]}[]> {
  const f: Fetch = opts.fetch ?? (url => fetch(url) as never);
  const api = (opts.api ?? process.env['SVG_DIAGRAM_ICONIFY_API'] ?? DEFAULT_API).replace(/\/$/, '');
  const allow = new Set([...PERMISSIVE, ...(opts.allowLicense ?? [])]);
  const limit = opts.limit ?? 6;
  const out: {word: string; candidates: Candidate[]; skipped: string[]}[] = [];
  for (const word of words) {
    const q = word.trim();
    if (!q) throw new Error('an empty word');
    // the main set is asked for on its own too: a generic search can fill its 64 hits with other sets
    const asks = [opts.sets?.length ? opts.sets.join(',') : undefined, ...(opts.mainSet && !opts.sets?.length ? [opts.mainSet] : [])];
    const ids: string[] = [];
    const infos: Record<string, CollectionInfo> = {};
    for (const set of asks) {
      const r = await getJson<{icons?: string[]; collections?: Record<string, CollectionInfo>}>(f, `${api}/search?query=${encodeURIComponent(q)}&limit=64${set ? `&prefixes=${encodeURIComponent(set)}` : ''}`);
      for (const id of r.icons ?? []) if (!ids.includes(id)) ids.push(id);
      Object.assign(infos, r.collections ?? {});
    }
    const skipped: string[] = [];
    const usable = new Map<string, string[]>();
    for (const id of ids) {
      const [prefix, name] = splitId(id);
      const lic = infos[prefix]?.license?.spdx;
      if (!lic || !allow.has(lic)) { if (!skipped.includes(`${prefix} (${lic ?? 'no licence'})`)) skipped.push(`${prefix} (${lic ?? 'no licence'})`); continue; }
      if (infos[prefix]?.palette && !opts.color) continue;
      usable.set(prefix, [...(usable.get(prefix) ?? []), name]);
    }
    // best first: the main set, then names that are the word itself, then the search's own order
    const rank = (id: string) => {
      const [prefix, name] = splitId(id);
      return (prefix === opts.mainSet ? 0 : 4) + (name === q ? 0 : name.startsWith(q + '-') || name.startsWith(q) ? 1 : 2);
    };
    const ordered = ids.filter(id => usable.get(splitId(id)[0])?.includes(splitId(id)[1])).map((id, i) => ({id, i})).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i).map(x => x.id);
    // bodies, one request per set, only for the icons that may be shown (a few more than `limit`: some will not convert)
    const wanted = new Map<string, string[]>();
    for (const id of ordered.slice(0, limit * 4)) { const [p, n] = splitId(id); wanted.set(p, [...(wanted.get(p) ?? []), n]); }
    const sets = new Map<string, IconifySet>();
    for (const [p, names] of wanted) sets.set(p, await getJson<IconifySet>(f, `${api}/${p}.json?icons=${encodeURIComponent(names.join(','))}`));
    const candidates: Candidate[] = [];
    for (const id of ordered) {
      if (candidates.length >= limit) break;
      const [prefix, name] = splitId(id);
      const set = sets.get(prefix);
      const direct = set?.icons?.[name];
      const alias = set?.aliases?.[name];
      const aliased = alias && set?.icons?.[alias.parent], t = direct ?? (alias && aliased ? {...aliased, ...alias, body: alias.body ?? aliased.body} : undefined);
      if (!set || !t || t.rotate || t.hFlip || t.vFlip) continue;
      let glyph: IconGlyph;
      try { glyph = glyphFromBody(t.body, {width: t.width ?? set.width ?? 16, height: t.height ?? set.height ?? t.width ?? set.width ?? 16, left: t.left, top: t.top}, id, {color: opts.color}); } catch { continue; }
      const style = styleOf(glyph);
      if (opts.style && opts.style !== 'any' && style !== opts.style) continue;
      candidates.push({id, prefix, name, style, license: must(must(must(infos[prefix]).license).spdx), mainSet: prefix === opts.mainSet, glyph, add: `${id}=${NAME_OK.test(q) ? q : name}`});
    }
    out.push({word: q, candidates, skipped});
  }
  return out;
}
