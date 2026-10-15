// A minimal DOM for running the deck viewer's script without a browser (jsdom is not a dependency): elements with attributes, classList,
// children, `.class` / `tag` selectors, focus, events, location.hash and history. Only what lib/deck-viewer/viewer.js uses.
export class El {
  attrs = new Map<string, string>();
  children: El[] = [];
  parent: El | null = null;
  listeners = new Map<string, Array<(ev: any) => void>>();
  textContent = '';
  isContentEditable = false;
  tagName: string;
  doc: Doc;
  constructor(tagName: string, doc: Doc) { this.tagName = tagName; this.doc = doc; }
  setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); }
  getAttribute(k: string) { return this.attrs.has(k) ? this.attrs.get(k)! : null; }
  hasAttribute(k: string) { return this.attrs.has(k); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  get classList() {
    const get = () => new Set((this.attrs.get('class') ?? '').split(/\s+/).filter(Boolean));
    const set = (s: Set<string>) => this.attrs.set('class', [...s].join(' '));
    return {
      add: (c: string) => { const s = get(); s.add(c); set(s); },
      remove: (c: string) => { const s = get(); s.delete(c); set(s); },
      contains: (c: string) => get().has(c),
      toggle: (c: string, on?: boolean) => { const s = get(); if (on ?? !s.has(c)) s.add(c); else s.delete(c); set(s); },
    };
  }
  appendChild(c: El) { c.parent = this; this.children.push(c); return c; }
  addEventListener(t: string, f: (ev: any) => void) { this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]); }
  focus() { this.doc.activeElement = this; }
  all(): El[] { return this.children.flatMap(c => [c, ...c.all()]); }
  matches(sel: string) {
    return sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tagName.toLowerCase() === sel.toLowerCase();
  }
  querySelectorAll(sel: string) { return this.all().filter(e => e.matches(sel)); }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
  fire(type: string, ev: Record<string, unknown> = {}) {
    const e = {type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...ev};
    for (const f of this.listeners.get(type) ?? []) f(e);
    return e;
  }
}

export class Doc {
  activeElement: El | null = null;
  documentElement: El;
  body: El;
  listeners = new Map<string, Array<(ev: any) => void>>();
  constructor(lang = 'ja') {
    this.documentElement = new El('html', this);
    this.documentElement.setAttribute('lang', lang);
    this.documentElement.setAttribute('class', 'no-js');
    this.body = this.documentElement.appendChild(new El('body', this));
  }
  createElement(tag: string) { return new El(tag, this); }
  getElementById(id: string) { return [this.documentElement, ...this.documentElement.all()].find(e => e.getAttribute('id') === id) ?? null; }
  addEventListener(t: string, f: (ev: any) => void) { this.listeners.set(t, [...(this.listeners.get(t) ?? []), f]); }
  key(key: string, mods: Record<string, unknown> = {}, target?: El) {
    const ev = {key, target: target ?? this.activeElement ?? this.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods};
    for (const f of this.listeners.get('keydown') ?? []) f(ev);
    return ev;
  }
}

/** A deck page as buildDeck makes it: `#deck` with `n` sections of `.slide`, each holding one <svg>. */
export function deckPage(n: number, names = ['one', 'two', 'three', 'four', 'five'], lang = 'ja') {
  const doc = new Doc(lang);
  const deck = doc.body.appendChild(new El('main', doc));
  deck.setAttribute('id', 'deck');
  const slides: El[] = [];
  for (let i = 0; i < n; i++) {
    const s = deck.appendChild(new El('section', doc));
    s.setAttribute('id', `s${i + 1}`);
    s.setAttribute('class', 'slide');
    s.setAttribute('aria-label', `${i + 1} / ${n}: ${names[i]}`);
    s.setAttribute('data-name', names[i]);
    s.appendChild(new El('svg', doc));
    slides.push(s);
  }
  const win = {
    hash: '', pushed: [] as string[], replaced: [] as string[],
    listeners: new Map<string, Array<(ev: any) => void>>(),
  };
  const location = {get hash() { return win.hash; }};
  const history = {
    pushState(_s: unknown, _t: string, url: string) { win.pushed.push(url); win.hash = url; },
    replaceState(_s: unknown, _t: string, url: string) { win.replaced.push(url); win.hash = url; },
  };
  const window = {location, history, addEventListener(t: string, f: (ev: any) => void) { win.listeners.set(t, [...(win.listeners.get(t) ?? []), f]); }};
  return {
    doc, deck, slides, window, win,
    /** The browser changes the hash by itself (the address bar, back): then `hashchange`. */
    navigateHash(h: string) { win.hash = h; for (const f of win.listeners.get('hashchange') ?? []) f({}); },
    bar: () => doc.body.children.find(c => c.classList.contains('deck-bar'))!,
    live: () => doc.body.children.find(c => c.getAttribute('role') === 'status')!,
    visible: () => slides.map(s => !s.hasAttribute('hidden')),
  };
}
