// One presentation (ADR 0056 D12-D15): a Durable Object with SQLite, holding the slides `--publish` sent and the one state every device
// follows, and talking to every device over WebSockets that hibernate (an idle presentation costs no time). The rules of following are
// core's (lib/present/sync.ts); the SVGs are checked against core's allowlist (lib/present/svg-allow.ts) before they are kept.
import {DurableObject} from 'cloudflare:workers';
import {allowGo, applyGo, followIndex, parsePresenter, POINTER_PER_SECOND, type StateMessage, type SyncState} from '../../lib/present/sync.ts';
import {checkSlideSvg} from '../../lib/present/svg-allow.ts';
import {readSettings, type Env, type Settings} from './config.ts';
import {randomToken, sameSecret, sha256Hex} from './auth.ts';

export type SlideMeta = {hash: string; title: string; text: string; notes: string; bytes: number};
export interface PublishInput {title: string; slides: SlideMeta[]; svgs: Record<string, string>}
export type PublishResult = {ok: true; version: number} | {ok: false; status: 409; need: string[]} | {ok: false; status: 413 | 422 | 400; problems: string[]};
interface Attachment {presenter: boolean; tid?: string; email?: string; gos: number[]; pointers?: number[]}

/** A value of SQLite in a Durable Object is at most 2 MB: an SVG is kept in pieces of this many characters (at most 3 bytes each). */
const CHUNK = 600_000;
/** At most this many presenter tokens per presentation (ADR 0056 D13). */
const MAX_TOKENS = 20;
/** Presenter connections at once (windows and devices of the presenters), apart from MAX_CONNECTIONS. */
const MAX_PRESENTER_SOCKETS = 20;
const enc = new TextEncoder();

export class Presentation extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }
  /** The tables, made by create() only: a deleted presentation (deleteAll drops them) is not brought back by a request to its old URL. */
  private schema(): void {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS slides (pos INTEGER PRIMARY KEY, hash TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, notes TEXT NOT NULL, bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS svgs (hash TEXT NOT NULL, n INTEGER NOT NULL, part TEXT NOT NULL, PRIMARY KEY (hash, n));
      CREATE TABLE IF NOT EXISTS tokens (tid TEXT PRIMARY KEY, hash TEXT NOT NULL)`);
  }

  private settings(): Settings {
    const r = readSettings(this.env);
    if (!r.ok) throw new Error('the Worker is not configured');
    return r.settings;
  }
  private get(k: string): string | undefined { return this.sql.exec<{v: string}>('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v; }
  private set(k: string, v: string | number): void { this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  private exists(): boolean {
    return this.sql.exec('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?', 'table', 'meta').toArray().length > 0 && this.get('created') !== undefined;
  }
  private state(): SyncState { return {epoch: this.get('epoch') ?? '', seq: Number(this.get('seq') ?? 0), index: Number(this.get('index') ?? 0), version: Number(this.get('version') ?? 0)}; }
  private saveState(s: SyncState): void { this.set('seq', s.seq); this.set('index', s.index); this.set('version', s.version); }
  private slides(): SlideMeta[] { return this.sql.exec<SlideMeta>('SELECT hash, title, text, notes, bytes FROM slides ORDER BY pos').toArray(); }
  private base(): string { return `/p/${this.ctx.id.toString()}`; }
  private stateMessage(): StateMessage {
    const st = this.state(), slides = this.slides(), cur = slides[st.index];
    return {type: 'state', ...st, slide: cur ? `${this.base()}/s/${cur.hash}.svg` : '', alt: cur?.text ?? '', total: slides.length, moved: this.get('moved') === '1', linked: this.get('linked') !== '0'};
  }
  private deckMessage() {
    return {type: 'deck', version: this.state().version, slides: this.slides().map(s => ({url: `${this.base()}/s/${s.hash}.svg`, title: s.title, text: s.text}))};
  }
  private broadcast(m: unknown, tag?: string): void {
    const text = JSON.stringify(m);
    for (const ws of this.ctx.getWebSockets(tag)) { try { ws.send(text); } catch { /* closing */ } }
  }
  /** A presenter taken off PRESENTER_EMAILS, or whose token was revoked, is disconnected (ADR 0056 D13); their next go is refused as well. */
  private async recheckPresenters(): Promise<void> {
    for (const ws of this.ctx.getWebSockets('role:presenter')) {
      const a = ws.deserializeAttachment() as Attachment | null;
      try { if (!a || !await this.stillPresenter(a)) ws.close(4003, 'no longer the presenter'); } catch { /* closing */ }
    }
  }
  private countToPresenters(): void { this.broadcast({type: 'count', viewers: this.ctx.getWebSockets('role:viewer').length}, 'role:presenter'); }
  /** Last used now: the presentation is deleted RETENTION_DAYS after (ADR 0056 D15). */
  private async touch(): Promise<void> { await this.ctx.storage.setAlarm(Date.now() + this.settings().retentionDays * 86_400_000); }

  // --- from `--publish` (the Worker has checked PUBLISH_TOKEN) -----------------------------------------------------------------
  /** A new presentation: its first presenter token. */
  async create(): Promise<{token: string}> {
    if (this.exists()) throw new Error('already created');
    this.schema();
    this.set('created', Date.now());
    this.set('epoch', randomToken(8));
    this.saveState({epoch: '', seq: 0, index: 0, version: 0});
    this.set('title', '');
    await this.touch();
    return {token: await this.addToken()};
  }

  /** The deck replaced by `input`: the SVGs it does not hold yet must come with it (else 409 with the hashes it needs). */
  async publish(input: PublishInput): Promise<PublishResult | null> {
    if (!this.exists()) return null;
    const s = this.settings();
    const problems: string[] = [];
    if (!Array.isArray(input.slides) || !input.slides.length) return {ok: false, status: 400, problems: ['a deck needs at least one slide']};
    if (input.slides.length > s.maxSlides) return {ok: false, status: 413, problems: [`${input.slides.length} slides: this Worker takes at most ${s.maxSlides} (MAX_SLIDES)`]};
    const held = new Set(this.sql.exec<{hash: string}>('SELECT DISTINCT hash FROM svgs').toArray().map(r => r.hash));
    const need = [...new Set(input.slides.map(x => x.hash))].filter(h => !held.has(h) && input.svgs[h] === undefined);
    if (need.length) return {ok: false, status: 409, need};
    // what arrives is checked here, not believed: its hash, its size, and core's allowlist (ADR 0056 D3)
    const sizes = new Map<string, number>();
    for (const [hash, svg] of Object.entries(input.svgs)) {
      if (!input.slides.some(x => x.hash === hash)) continue;
      const bytes = enc.encode(svg).length;
      sizes.set(hash, bytes);
      if (await sha256Hex(svg) !== hash) { problems.push(`a slide's SVG does not match its hash ${hash.slice(0, 12)}…`); continue; }
      const where = `slides[${input.slides.findIndex(x => x.hash === hash)}]`;
      if (bytes > s.maxSlideBytes) { return {ok: false, status: 413, problems: [`${where}: ${bytes} bytes; this Worker takes at most ${s.maxSlideBytes} per slide (MAX_SLIDE_BYTES): make its pictures smaller`]}; }
      const check = checkSlideSvg(svg);
      if (!check.ok) for (const p of check.problems) problems.push(`${where}: ${p.what} (${p.where})`);
    }
    if (problems.length) return {ok: false, status: 422, problems};
    const sizeOf = (h: string): number => sizes.get(h) ?? Number(this.sql.exec<{b: number}>('SELECT SUM(LENGTH(CAST(part AS BLOB))) AS b FROM svgs WHERE hash = ?', h).one().b);
    const total = [...new Set(input.slides.map(x => x.hash))].reduce((n, h) => n + sizeOf(h), 0);
    if (total > s.maxDeckBytes) return {ok: false, status: 413, problems: [`the slides' SVGs come to ${total} bytes together; this Worker takes at most ${s.maxDeckBytes} (MAX_DECK_BYTES), whatever the number of slides: make the pictures smaller, split the deck, or raise MAX_DECK_BYTES`]};
    const before = this.slides(), st = this.state();
    this.ctx.storage.transactionSync(() => {
      for (const [hash, svg] of Object.entries(input.svgs)) {
        if (held.has(hash) || !sizes.has(hash)) continue;
        for (let i = 0, n = 0; i < svg.length; n++) {
          // a piece never ends between the two halves of a surrogate pair (an emoji left as text): a lone half would not survive as text
          let end = Math.min(svg.length, i + CHUNK);
          if (end < svg.length && /[\uD800-\uDBFF]/.test(svg[end - 1] ?? '')) end--;
          this.sql.exec('INSERT OR REPLACE INTO svgs (hash, n, part) VALUES (?, ?, ?)', hash, n, svg.slice(i, end));
          i = end;
        }
        held.add(hash);
      }
      this.sql.exec('DELETE FROM slides');
      input.slides.forEach((x, pos) => this.sql.exec('INSERT INTO slides (pos, hash, title, text, notes, bytes) VALUES (?, ?, ?, ?, ?, ?)', pos, x.hash, String(x.title ?? ''), String(x.text ?? ''), String(x.notes ?? ''), sizeOf(x.hash)));
      // a slide no longer in the deck is gone: its URL answers 404, and storage does not grow with every publish
      const keep = new Set(input.slides.map(x => x.hash));
      for (const h of held) if (!keep.has(h)) this.sql.exec('DELETE FROM svgs WHERE hash = ?', h);
      this.set('title', String(input.title ?? ''));
      const index = followIndex(before, input.slides, st.index);
      this.saveState({...st, seq: st.seq + 1, index, version: st.version + 1});
    });
    await this.touch();
    this.broadcast(this.stateMessage());
    // every slide is the viewers' too (ADR 0062)
    this.broadcast(this.deckMessage());
    await this.recheckPresenters();
    return {ok: true, version: this.state().version};
  }

  async remove(): Promise<boolean> {
    if (!this.exists()) return false;
    for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'deleted'); } catch { /* gone */ } }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    return true;
  }
  async alarm(): Promise<void> { await this.remove(); }

  async addToken(): Promise<string> {
    const n = this.sql.exec<{n: number}>('SELECT COUNT(*) AS n FROM tokens').one().n;
    if (n >= MAX_TOKENS) throw new Error(`at most ${MAX_TOKENS} presenter tokens: revoke them first`);
    const token = randomToken(), tid = randomToken(6);
    this.sql.exec('INSERT INTO tokens (tid, hash) VALUES (?, ?)', tid, await sha256Hex(token));
    return token;
  }
  /** Every presenter token revoked, and every connection that came in by one closed. */
  async revokeTokens(): Promise<void> {
    const tids = this.sql.exec<{tid: string}>('SELECT tid FROM tokens').toArray().map(r => r.tid);
    this.sql.exec('DELETE FROM tokens');
    for (const tid of tids) for (const ws of this.ctx.getWebSockets(`tok:${tid}`)) { try { ws.close(4001, 'revoked'); } catch { /* gone */ } }
  }

  // --- from the Worker, for a device ----------------------------------------------------------------------------------------
  async info(): Promise<{exists: boolean; title: string; first: string}> {
    return this.exists() ? {exists: true, title: this.get('title') ?? '', first: this.slides()[0]?.title ?? ''} : {exists: false, title: '', first: ''};
  }
  /** The token's id, when it is one of this presentation's. */
  async tokenId(token: string): Promise<string | null> {
    if (!this.exists()) return null;
    const hash = await sha256Hex(token);
    for (const r of this.sql.exec<{tid: string; hash: string}>('SELECT tid, hash FROM tokens').toArray()) if (sameSecret(r.hash, hash)) return r.tid;
    return null;
  }
  async tokenLive(tid: string): Promise<boolean> { return this.exists() && this.sql.exec('SELECT 1 FROM tokens WHERE tid = ?', tid).toArray().length > 0; }
  /** A slide of the current deck only (a slide taken out or rewritten is gone). */
  async svg(hash: string): Promise<string | null> {
    if (!this.exists() || !this.sql.exec('SELECT 1 FROM slides WHERE hash = ?', hash).toArray().length) return null;
    return this.sql.exec<{part: string}>('SELECT part FROM svgs WHERE hash = ? ORDER BY n', hash).toArray().map(r => r.part).join('');
  }
  async notes(): Promise<{version: number; notes: string[]}> { return {version: this.state().version, notes: this.slides().map(s => s.notes)}; }
  async printable(): Promise<{title: string; slides: {url: string; text: string}[]}> {
    return {title: this.get('title') ?? '', slides: this.slides().map(s => ({url: `${this.base()}/s/${s.hash}.svg`, text: s.text}))};
  }

  /** A WebSocket: the Worker has decided the role (headers it sets itself, after taking out any a device sent). */
  override async fetch(req: Request): Promise<Response> {
    if (!this.exists()) return new Response('no such presentation', {status: 404});
    const s = this.settings();
    const presenter = req.headers.get('x-sd-role') === 'presenter';
    // viewers are counted against MAX_CONNECTIONS; presenters have their own few places, so a crowd (or a script) of viewers cannot lock them out
    if (presenter ? this.ctx.getWebSockets('role:presenter').length >= MAX_PRESENTER_SOCKETS : this.ctx.getWebSockets('role:viewer').length >= s.maxConnections) return new Response('this presentation is full', {status: 503});
    const tid = req.headers.get('x-sd-tid') ?? undefined, email = req.headers.get('x-sd-email') ?? undefined;
    const pair = new WebSocketPair(), ws = pair[1];
    const tags = [presenter ? 'role:presenter' : 'role:viewer', ...(tid ? [`tok:${tid}`] : []), ...(email ? [`email:${(await sha256Hex(email.toLowerCase())).slice(0, 32)}`] : [])];
    this.ctx.acceptWebSocket(ws, tags);
    ws.serializeAttachment({presenter, tid, email, gos: []} satisfies Attachment);
    ws.send(JSON.stringify({type: 'hello', role: presenter ? 'presenter' : 'viewer'}));
    ws.send(JSON.stringify(this.stateMessage()));
    ws.send(JSON.stringify(this.deckMessage()));
    if (presenter) await this.touch();
    this.countToPresenters();
    return new Response(null, {status: 101, webSocket: pair[0]});
  }

  /** Still the presenter? A revoked token or an address taken off PRESENTER_EMAILS stops being one, on an open connection too (ADR 0056 D13). */
  private async stillPresenter(a: Attachment): Promise<boolean> {
    if (!a.presenter) return false;
    if (a.tid) return this.tokenLive(a.tid);
    if (a.email) { const s = this.settings(); return s.login !== 'none' && s.presenterEmails.includes(a.email.toLowerCase()); }
    return false;
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null;
    // a viewer's message is dropped, not answered
    if (!a?.presenter || typeof raw !== 'string') return;
    if (!await this.stillPresenter(a)) { try { ws.close(4003, 'no longer the presenter'); } catch { /* gone */ } return; }
    const m = parsePresenter(raw);
    if (!m) return;
    if (m.type === 'pointer' || m.type === 'zoom') {
      // the laser pointer and the presenter's zoom: passed on, not kept
      a.pointers ??= [];
      const ok = allowGo(a.pointers, Date.now(), POINTER_PER_SECOND);
      ws.serializeAttachment(a);
      if (ok) this.broadcast(m);
      return;
    }
    const ok = allowGo(a.gos, Date.now());
    ws.serializeAttachment(a);
    if (!ok) return;
    if (m.type === 'link') {
      const linked = this.get('linked') !== '0';
      if (linked === m.on) return;
      this.set('linked', m.on ? 1 : 0);
      const st = this.state();
      this.saveState({...st, seq: st.seq + 1});
      this.broadcast(this.stateMessage());
      return;
    }
    const next = applyGo(this.state(), m, this.slides().length);
    if (!next) return;
    this.saveState(next);
    this.set('moved', 1);
    this.broadcast(this.stateMessage());
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch { /* closed */ }
    this.countToPresenters();
  }
  override async webSocketError(): Promise<void> { this.countToPresenters(); }
}
