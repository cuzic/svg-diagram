// Terminal plumbing for `svg-diagram show`: asking the terminal what it can do, sizing the picture to it, and wrapping
// sixel for tmux. The parsing and sizing are pure (tested); only queryTerminal() touches /dev/tty.
import fs from 'node:fs';
import tty from 'node:tty';

export interface TermInfo {
  /** DA1 attributes (4 = sixel). null when the terminal never answered. */
  da1: number[] | null;
  /** Text-area size in pixels (CSI 14 t), cell size (CSI 16 t), and the grid in columns/rows, when known. */
  windowPx: {w: number; h: number} | null;
  cellPx: {w: number; h: number} | null;
  cols: number | null;
  rows: number | null;
  /** XTVERSION, e.g. "tmux 3.3a" or "WindowsTerminal 1.22". */
  version: string | null;
}

const ESC = '\x1b';
/** CSI 16 t, CSI 14 t, XTVERSION, then DA1 — which every terminal answers, so it marks the end of the replies. */
export const QUERY = `${ESC}[16t${ESC}[14t${ESC}[>0q${ESC}[c`;

export function parseReplies(raw: string): Omit<TermInfo, 'cols' | 'rows'> & {complete: boolean} {
  const px = (code: number) => { const m = new RegExp(`\\x1b\\[${code};(\\d+);(\\d+)t`).exec(raw); return m ? {w: Number(m[2]), h: Number(m[1])} : null; };
  const da1 = /\x1b\[\?([0-9;]*)c/.exec(raw);
  const ver = /\x1bP>\|([^\x1b]*)\x1b\\/.exec(raw);
  return {
    da1: da1 ? da1[1].split(';').filter(Boolean).map(Number) : null,
    windowPx: px(4), cellPx: px(6),
    version: ver ? ver[1] : null,
    complete: !!da1,
  };
}

export const supportsSixel = (t: Pick<TermInfo, 'da1'>) => !!t.da1?.includes(4);
export const isTmux = (t: Pick<TermInfo, 'version'>) => /^tmux\b/.test(t.version ?? '');

/**
 * Ask the controlling terminal (not stdin, which may be a pipe). null when there is none. Only call it when stdout is that
 * terminal: the replies arrive as input, so asking a terminal the output is not going to would inject them into whatever
 * runs there. Raw mode is put back on every way out, including Ctrl-C (which raw mode turns into a byte) and kill signals.
 */
export async function queryTerminal(timeoutMs = 1500): Promise<TermInfo | null> {
  let fd: number;
  try { fd = fs.openSync('/dev/tty', 'r+'); } catch { return null; } // ENXIO: no controlling terminal (cron, CI)
  const input = new tty.ReadStream(fd); // owns fd: destroying it closes it, once
  let raw = '';
  let restored = false;
  const restore = () => { if (restored) return; restored = true; try { input.setRawMode(false); } catch { /* already closed */ } };
  const onSignal = (sig: NodeJS.Signals) => { restore(); process.kill(process.pid, sig); };
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const sig of signals) process.once(sig, onSignal);
  try {
    input.setRawMode(true);
    const done = new Promise<void>(resolve => {
      const t = setTimeout(resolve, timeoutMs);
      input.on('data', chunk => {
        raw += chunk.toString('latin1');
        if (raw.includes('\x03')) { restore(); process.kill(process.pid, 'SIGINT'); } // Ctrl-C while waiting
        if (/\x1b\[\?[0-9;]*c/.test(raw)) { clearTimeout(t); resolve(); }
      });
    });
    fs.writeSync(fd, QUERY);
    await done;
    const r = parseReplies(raw.slice(0, (/\x1b\[\?[0-9;]*c/.exec(raw)?.index ?? raw.length) + 64)); // bytes after DA1's `c` (typed-ahead keys) are dropped
    return {da1: r.da1, windowPx: r.windowPx, cellPx: r.cellPx, version: r.version, cols: process.stdout.columns || null, rows: process.stdout.rows || null};
  } finally {
    restore();
    for (const sig of signals) process.removeListener(sig, onSignal);
    input.destroy();
  }
}

/** The widest picture, in pixels, that fits the terminal; and a cap on its height. */
export function fitBox(t: Pick<TermInfo, 'windowPx' | 'cellPx' | 'cols' | 'rows'> | null, o: {cellWidthGuess?: number; fallbackWidth?: number} = {}): {maxW: number; maxH: number; estimated: boolean} {
  const fallbackW = o.fallbackWidth ?? 1200, fallbackH = 1200;
  if (t?.cellPx && t.cols) return {maxW: t.cellPx.w * t.cols, maxH: 3 * (t.rows ? t.cellPx.h * t.rows : fallbackH), estimated: false};
  if (t?.windowPx) return {maxW: t.windowPx.w, maxH: 3 * t.windowPx.h, estimated: false};
  if (t?.cols && o.cellWidthGuess) return {maxW: t.cols * o.cellWidthGuess, maxH: 3 * fallbackH, estimated: true};
  return {maxW: fallbackW, maxH: 3 * fallbackH, estimated: true};
}

/** The scale (at most 1: it never enlarges) at which a w×h picture fits maxW×maxH. */
export function fitScale(w: number, h: number, maxW: number, maxH: number): number {
  return Math.min(1, maxW / w, maxH / h);
}

/** Wrap a sixel DCS for tmux's passthrough (`allow-passthrough on`): every ESC doubled, the whole in \ePtmux; … \e\\. */
export function tmuxPassthrough(seq: string): string {
  return `${ESC}Ptmux;${seq.replace(/\x1b/g, `${ESC}${ESC}`)}${ESC}\\`;
}
