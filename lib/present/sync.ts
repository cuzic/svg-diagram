// The rules of following the presenter (ADR 0056 D6), as pure functions shared by the local server (SSE + POST) and the Worker (a Durable
// Object with WebSockets): what a client may send, how the one state moves, which state a client takes, where the current slide goes when
// the deck changes, how fast a presenter may press, and how long a client waits before it reconnects.

/** The version of what `--publish` and the Worker send each other; they refuse each other when it differs (ADR 0056 D11). */
export const PROTOCOL = 1;

/** The one state of a presentation: `epoch` is the server's (a local start, a Worker presentation), `seq` counts the moves, `version` the deck's. */
export interface SyncState {epoch: string; seq: number; index: number; version: number}
/** What a presenter sends: a step (next / previous, summed in order) or a slide to go to. */
export type GoMessage = {type: 'go'; delta: number} | {type: 'go'; index: number};
/** What every client is sent when the state changes: the state, the current slide's URL and what it says (for <img alt>). */
export interface StateMessage extends SyncState {type: 'state'; slide: string; alt: string; total: number; /** Someone has moved since this server started: a presenter's page puts back its slide only while this is false. */ moved: boolean}

/** A presenter's go, or null when `raw` is anything else (a viewer's or a malformed message is dropped, not answered). */
export function parseGo(raw: unknown): GoMessage | null {
  let v: unknown = raw;
  if (typeof raw === 'string') { if (raw.length > 200) return null; try { v = JSON.parse(raw); } catch { return null; } }
  if (typeof v !== 'object' || v === null || (v as {type?: unknown}).type !== 'go') return null;
  const {delta, index} = v as {delta?: unknown; index?: unknown};
  const int = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && Math.abs(x) <= 10_000;
  if (int(delta) && index === undefined) return {type: 'go', delta};
  if (int(index) && delta === undefined && index >= 0) return {type: 'go', index};
  return null;
}

const clamp = (i: number, total: number): number => Math.max(0, Math.min(total - 1, i));

/** The state after `go` on a deck of `total` slides, or null when it does not move (nothing to send). */
export function applyGo(s: SyncState, go: GoMessage, total: number): SyncState | null {
  if (total < 1) return null;
  const to = clamp('delta' in go ? s.index + go.delta : go.index, total);
  return to === s.index ? null : {...s, seq: s.seq + 1, index: to};
}

/** Whether a client that holds `held` takes `got`: a new epoch replaces everything; within one, only a later move (an old message never moves it back). */
export function takes(held: {epoch: string; seq: number} | null, got: {epoch: string; seq: number}): boolean {
  return !held || held.epoch !== got.epoch || got.seq > held.seq;
}

/**
 * Where the current slide is once the deck has changed (ADR 0056 D6): the slide with the same content (hash), else the same heading, else
 * the same number kept within the deck, so a slide added or removed before it does not move everyone to a different slide.
 */
export function followIndex(before: readonly {hash: string; title: string}[], after: readonly {hash: string; title: string}[], index: number): number {
  if (!after.length) return 0;
  const was = before[index];
  if (was) {
    const same = after.findIndex(s => s.hash === was.hash);
    if (same >= 0) return same;
    if (was.title) {
      const titled = after.findIndex(s => s.title === was.title);
      if (titled >= 0) return titled;
    }
  }
  return clamp(index, after.length);
}

/** At most this many gos per presenter connection per second; the rest are dropped (ADR 0056 D6). */
export const GO_PER_SECOND = 10;
/** Whether a go at `now` (ms) fits the presenter's recent gos `times` (kept in place: the times within the last second). */
export function allowGo(times: number[], now: number): boolean {
  while (times.length && (times[0] as number) <= now - 1000) times.shift();
  if (times.length >= GO_PER_SECOND) return false;
  times.push(now);
  return true;
}

/** Reconnecting (ADR 0056 D6): 0.5 s first, doubled each failure up to 30 s, each moved by ±50 % (`random` in [0, 1)). */
export function reconnectDelay(failures: number, random: number): number {
  const base = Math.min(30_000, 500 * 2 ** Math.max(0, failures));
  return Math.round(base * (0.5 + random));
}
/** A connection that has held this long counts as good again: the next failure waits 0.5 s. */
export const STABLE_MS = 10_000;

