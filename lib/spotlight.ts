import type {Band, DiagramData, LaidOutBand, LaidOutDiagram, Rect} from './types.ts';

export function spotlightIds(d: Pick<DiagramData, 'spotlight'>): string[] {
  if (!d.spotlight) return [];
  const ids = typeof d.spotlight === 'string' ? d.spotlight : d.spotlight.ids;
  return typeof ids === 'string' ? [ids] : [...ids];
}

/** How a bar outside the spotlight is drawn: a dotted outline (default) or a pale fill. */
export function spotlightDim(d: Pick<DiagramData, 'spotlight'>): 'outline' | 'fill' {
  return typeof d.spotlight === 'object' ? d.spotlight.dim ?? 'outline' : 'outline';
}

export function spotlightEdges(d: Pick<DiagramData, 'spotlight'>): 'touching' | 'between' {
  return typeof d.spotlight === 'object' ? d.spotlight.edges ?? 'touching' : 'touching';
}

function descendants(b: Band, out: Set<Band>): void {
  out.add(b);
  if ('children' in b && Array.isArray(b.children)) for (const child of b.children as Band[]) descendants(child, out);
  if (b.type === 'swimlane') for (const step of b.steps) descendants(step, out);
}

/** Input bands outside the spotlight. Used before layout so auto legends ignore their notation. */
export function dimmedBands(d: Pick<DiagramData, 'bands' | 'spotlight'>): Set<Band> {
  const targets = new Set(spotlightIds(d));
  const focused = new Set<Band>();
  const walk = (bands: Band[]): void => {
    for (const b of bands) {
      const id = 'id' in b ? b.id : undefined;
      if (id && targets.has(id)) descendants(b, focused);
      if ((b.type === 'row' || b.type === 'grouprow') && id) {
        for (const target of targets) {
          const m = target.match(new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#(\\d+)$`));
          if (m) {
            const child = b.children[Number(m[1]) - 1];
            if (child) descendants(child, focused);
          }
        }
      }
      if ('children' in b && Array.isArray(b.children)) walk(b.children as Band[]);
    }
  };
  walk(d.bands);
  const focusedIds = new Set<string>(targets);
  for (const b of focused) if ('id' in b && b.id) focusedIds.add(b.id);
  const between = spotlightEdges(d) === 'between';
  for (const b of allBands(d.bands)) if (b.type === 'connect') {
    const from = focusedIds.has(b.from.split(':')[0]), to = focusedIds.has(b.to.split(':')[0]);
    if (between ? from && to : from || to) focused.add(b);
  }
  return new Set(d.bands.length && targets.size ? allBands(d.bands).filter(b => !focused.has(b)) : []);
}

function allBands(bands: Band[], out: Band[] = []): Band[] {
  for (const b of bands) {
    out.push(b);
    if ('children' in b && Array.isArray(b.children)) allBands(b.children as Band[], out);
  }
  return out;
}

const inside = (b: Rect, r: Rect): boolean => b.x >= r.x - 0.5 && b.y >= r.y - 0.5 && b.x + b.w <= r.x + r.w + 0.5 && b.y + b.h <= r.y + r.h + 0.5;

function targetRects(d: LaidOutDiagram, ids: string[]): Rect[] {
  const out: Rect[] = [];
  const add = (b: LaidOutBand): void => {
    if ('id' in b && 'h' in b && b.id && ids.includes(b.id)) out.push(b);
    if (b.type === 'row') {
      if (b.id && ids.includes(b.id)) out.push(b);
      for (const id of ids) {
        const m = b.id && id.match(new RegExp(`^${b.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#(\\d+)$`));
        if (m && b.children[Number(m[1]) - 1]) out.push(b.children[Number(m[1]) - 1]);
      }
      for (const c of b.children) if (c.id && ids.includes(c.id)) out.push(c);
    } else if (b.type === 'grid') {
      for (const c of b.children) if (c.id && ids.includes(c.id)) out.push(c);
    } else if (b.type === 'bars' || b.type === 'image') {
      for (const a of b.anchors) if (ids.includes(a.id)) out.push(a);
    }
  };
  d.laidOut.forEach(add);
  return out;
}

function dimBand(b: LaidOutBand, focus: Rect[]): void {
  if (b.type === 'caption' && b.sourceLine) return; // the pinned source line is furniture, never a spotlight subject
  if (b.type === 'bars') {
    // the whole band focused (e.g. inside a focused group): nothing dims. Otherwise dim bar by bar, labels with their bar;
    // the axis dims only when no bar is a target.
    if (focus.some(r => inside(b, r))) return;
    for (const x of b.bars) x.dim = !focus.some(r => inside(x, r));
    for (const t of b.texts) if (t.bar !== undefined) t.dim = b.bars[t.bar].dim;
    b.dim = b.bars.every(x => x.dim);
  } else if (b.type === 'image') {
    // the whole picture focused (itself, or an enclosing group): nothing dims. Otherwise a focused mark keeps its region clear of
    // the veil and the other marks dim; with no mark focused the picture is veiled whole.
    if (focus.some(r => inside(b, r))) { b.dim = false; return; }
    const lit = b.marks.map(m => focus.some(r => inside(m, r)));
    b.marks.forEach((m, i) => { m.dim = !lit[i]; });
    b.plates.forEach(p => { p.dim = p.mark === undefined ? true : !lit[p.mark]; });
    const holes = b.marks.filter((_m, i) => lit[i]).map(({x, y, w, h}) => ({x, y, w, h}));
    if (holes.length) b.holes = holes; else b.dim = true;
  } else if (b.type === 'row' || b.type === 'grid') {
    for (const c of b.children) c.dim = !focus.some(r => inside(c, r));
    b.dim = b.children.every(c => c.dim);
  } else b.dim = !focus.some(r => inside(b, r));
}

/** Adds the internal dim flag after geometry is fixed; coordinates and existing diagrams stay untouched. */
export function applySpotlight(d: LaidOutDiagram): void {
  const ids = spotlightIds(d);
  if (!ids.length) return;
  const found = ids.map(id => targetRects(d, [id]));
  const missing = ids.filter((_id, i) => !found[i].length);
  if (missing.length) throw new Error(`diagram({spotlight}): unknown anchor id${missing.length > 1 ? 's' : ''} "${missing.join('", "')}"`);
  const focus = found.flat();
  d.laidOut.forEach(b => dimBand(b, focus));
  const findId = (id: string): Rect | undefined => {
    for (const b of d.laidOut) {
      if ('id' in b && 'h' in b && b.id === id) return b;
      if (b.type === 'row' || b.type === 'grid') { const c = b.children.find(x => x.id === id); if (c) return c; }
      if (b.type === 'bars' || b.type === 'image') { const a = b.anchors.find(x => x.id === id); if (a) return a; }
    }
    return undefined;
  };
  const endpointIsFocused = (id: string) => ids.includes(id) || focus.some(r => {
    const hit = findId(id);
    return !!hit && inside(hit, r);
  });
  const between = spotlightEdges(d) === 'between';
  for (const c of d.connects) {
    const from = endpointIsFocused(c.fromId), to = endpointIsFocused(c.toId);
    c.dim = between ? !(from && to) : !(from || to);
  }
}
