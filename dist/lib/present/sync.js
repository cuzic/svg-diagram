// The rules of following the presenter (ADR 0056 D6), as pure functions shared by the local server (SSE + POST) and the Worker (a Durable
// Object with WebSockets): what a client may send, how the one state moves, which state a client takes, where the current slide goes when
// the deck changes, how fast a presenter may press, and how long a client waits before it reconnects.
/** The version of what `--publish` and the Worker send each other; they refuse each other when it differs (ADR 0056 D11). */
export const PROTOCOL = 2;
/** The largest zoom. */
export const MAX_ZOOM = 6;
/** A presenter's message of any kind, or null (anything else is dropped). */
export function parsePresenter(raw) {
    const go = parseGo(raw);
    if (go)
        return go;
    let v = raw;
    if (typeof raw === 'string') {
        if (raw.length > 200)
            return null;
        try {
            v = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    if (typeof v !== 'object' || v === null)
        return null;
    const m = v;
    if (m['type'] === 'link' && typeof m['on'] === 'boolean' && Object.keys(m).length === 2)
        return { type: 'link', on: m['on'] };
    if (m['type'] === 'zoom') {
        const { index, z, x, y } = m, unit = (n) => typeof n === 'number' && n >= 0 && n <= 1;
        if (typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && typeof z === 'number' && z >= 1 && z <= MAX_ZOOM && unit(x) && unit(y) && Object.keys(m).length === 5) {
            const r = (n) => Math.round(n * 1e4) / 1e4;
            return { type: 'zoom', index, z: r(z), x: r(x), y: r(y) };
        }
        return null;
    }
    if (m['type'] === 'pointer') {
        if (m['off'] === true && Object.keys(m).length === 2)
            return { type: 'pointer', off: true };
        const { index, x, y, spot, r } = m, unit = (n) => typeof n === 'number' && n >= 0 && n <= 1;
        const known = Object.keys(m).every(k => ['type', 'index', 'x', 'y', 'spot', 'r'].includes(k));
        if (!known || !(typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && unit(x) && unit(y)))
            return null;
        const out = { type: 'pointer', index, x: Math.round(x * 1e4) / 1e4, y: Math.round(y * 1e4) / 1e4 };
        if (spot === undefined && r === undefined)
            return out;
        if (spot !== true || typeof r !== 'number' || !(r >= 0.03 && r <= 0.5))
            return null;
        return { ...out, spot: true, r: Math.round(r * 1e4) / 1e4 };
    }
    return null;
}
/** At most this many pointer messages per presenter connection per second; the rest are dropped (a pointer moves often, a slide does not). */
export const POINTER_PER_SECOND = 30;
/** A presenter's go, or null when `raw` is anything else (a viewer's or a malformed message is dropped, not answered). */
export function parseGo(raw) {
    let v = raw;
    if (typeof raw === 'string') {
        if (raw.length > 200)
            return null;
        try {
            v = JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    if (typeof v !== 'object' || v === null || v.type !== 'go')
        return null;
    const { delta, index } = v;
    const int = (x) => typeof x === 'number' && Number.isSafeInteger(x) && Math.abs(x) <= 10_000;
    if (int(delta) && index === undefined)
        return { type: 'go', delta };
    if (int(index) && delta === undefined && index >= 0)
        return { type: 'go', index };
    return null;
}
const clamp = (i, total) => Math.max(0, Math.min(total - 1, i));
/** The state after `go` on a deck of `total` slides, or null when it does not move (nothing to send). */
export function applyGo(s, go, total) {
    if (total < 1)
        return null;
    const to = clamp('delta' in go ? s.index + go.delta : go.index, total);
    return to === s.index ? null : { ...s, seq: s.seq + 1, index: to };
}
/** Whether a client that holds `held` takes `got`: a new epoch replaces everything; within one, only a later move (an old message never moves it back). */
export function takes(held, got) {
    return !held || held.epoch !== got.epoch || got.seq > held.seq;
}
/**
 * Where the current slide is once the deck has changed (ADR 0056 D6): the slide with the same content (hash), else the same heading, else
 * the same number kept within the deck, so a slide added or removed before it does not move everyone to a different slide.
 */
export function followIndex(before, after, index) {
    if (!after.length)
        return 0;
    const was = before[index];
    if (was) {
        const same = after.findIndex(s => s.hash === was.hash);
        if (same >= 0)
            return same;
        if (was.title) {
            const titled = after.findIndex(s => s.title === was.title);
            if (titled >= 0)
                return titled;
        }
    }
    return clamp(index, after.length);
}
/** At most this many gos per presenter connection per second; the rest are dropped (ADR 0056 D6). */
export const GO_PER_SECOND = 10;
/** Whether a go at `now` (ms) fits the presenter's recent gos `times` (kept in place: the times within the last second). */
export function allowGo(times, now, perSecond = GO_PER_SECOND) {
    while (times.length && times[0] <= now - 1000)
        times.shift();
    if (times.length >= perSecond)
        return false;
    times.push(now);
    return true;
}
/** Reconnecting (ADR 0056 D6): 0.5 s first, doubled each failure up to 30 s, each moved by ±50 % (`random` in [0, 1)). */
export function reconnectDelay(failures, random) {
    const base = Math.min(30_000, 500 * 2 ** Math.max(0, failures));
    return Math.round(base * (0.5 + random));
}
/** A connection that has held this long counts as good again: the next failure waits 0.5 s. */
export const STABLE_MS = 10_000;
