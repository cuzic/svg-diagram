// The icon names a figure can use, in two kinds:
//   - path icons: SVG paths the *project* installed (`svg-diagram icons add mdi:key-variant=key` → svg-diagram.icons.json), drawn
//     as shapes by box({icon}) and iconRow(), coloured by the tone tokens. svg-diagram ships none of them: icons come from free
//     sets (Material Design Icons, Material Symbols, ...), each with its own licence, which the project then holds. Cannot go
//     inside a string.
//   - EMOJIS: emoji for use inside text (`${icon.emoji('key')} 鍵の管理`) — the look depends on the viewer's emoji font. Every one
//     is inside tokens.ts's EMOJI_RE (so emit.ts wraps it in class="emoji") and in Noto Color Emoji (test/icons.test.ts checks
//     both). Emoji that need a U+FE0F selector (⚠️ ⚙️ ☁️ ✅ 🗄️) are left out: EMOJI_RE does not match the selector.
// Pictograms help memory, not understanding: use them in the one or two figures where the metaphor is the point.

import fs from 'node:fs';
import path from 'node:path';
import {MANIFEST_FILE, parseManifest} from './icon-store.ts';
import type {IconGlyph, IconManifest} from './icon-store.ts';

/** A path icon's name: whatever the project installed (checked when box({icon}) is built). */
export type IconName = string;

export const EMOJIS = {
  person: '🧑',
  people: '👥',
  document: '📄',
  folder: '📁',
  key: '🔑',
  lock: '🔒',
  bridge: '🌉',
  fence: '🚧',
  ladder: '🪜', // there is no staircase emoji: the ladder is the nearest "climb step by step"
  idea: '💡',
  search: '🔍',
  tool: '🔧',
  globe: '🌐', // for "the network / cloud": ☁ is outside EMOJI_RE
  database: '💾', // for "storage": 🗄 needs a variation selector
  mail: '📧',
  warning: '🚨', // ⚠ needs a variation selector
  target: '🎯',
  link: '🔗',
  // food (ingredients, meals — "the dinner" kind of metaphor)
  rice: '🍚',
  riceplant: '🌾',
  onigiri: '🍙',
  bento: '🍱',
  noodles: '🍜',
  bread: '🍞',
  salad: '🥗',
  carrot: '🥕',
  apple: '🍎',
  meat: '🥩',
  fish: '🐟',
  egg: '🥚',
  milk: '🥛',
  cooking: '🍳',
  ice: '🧊',
  package: '📦',
  // tools, places, things
  hammer: '🔨',
  toolbox: '🧰',
  house: '🏠',
  office: '🏢',
  rocket: '🚀',
  bell: '🔔',
  fire: '🔥',
  money: '💰',
  calendar: '📅',
  memo: '📝',
  clock: '🕐',
  chart: '📊',
  growth: '📈',
  decline: '📉',
  speech: '💬',
  // people and faces
  smile: '😀',
  thinking: '🤔',
  sweat: '😅',
  sad: '😢',
  angry: '😠',
  sleepy: '😴',
  thumbsup: '👍',
  clap: '👏',
  pray: '🙏',
  eyes: '👀',
  brain: '🧠',
  handshake: '🤝',
  runner: '🏃',
} as const;
export type EmojiName = keyof typeof EMOJIS;

const own = (o: object, k: string): boolean => Object.hasOwn(o, k);

// ---- the project's installed icons ---------------------------------------------------------------------------------------
// Found like .svg-diagram.json: svg-diagram.icons.json in the current directory or the nearest parent. Read once per directory;
// icon.use() points a process at a file or a manifest explicitly (tests, tools that render for several projects).

let explicit: IconManifest | undefined;
const found = new Map<string, IconManifest>();

/** Path of the manifest that applies from `from`, or undefined. */
export function findManifest(from: string = process.cwd()): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    const f = path.join(dir, MANIFEST_FILE);
    if (fs.existsSync(f)) return f;
    const up = path.dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

function installed(): IconManifest | undefined {
  if (explicit) return explicit;
  const file = findManifest();
  if (!file) return undefined;
  let m = found.get(file);
  if (!m) found.set(file, m = parseManifest(fs.readFileSync(file, 'utf8'), file));
  return m;
}

/** The installed glyph for a name, or undefined. */
export function glyphOf(name: string): IconGlyph | undefined {
  const m = installed();
  return m && own(m.icons, name) ? m.icons[name] : undefined;
}

function installedNames(): string[] {
  return Object.keys(installed()?.icons ?? {});
}

export const icon = {
  /** The emoji for use inside a string. Throws on a name the emoji set does not have (see `icon.has`). */
  emoji(name: EmojiName): string {
    if (!own(EMOJIS, name)) throw new Error(`icon.emoji(): unknown emoji icon "${name}" — one of ${Object.keys(EMOJIS).join(', ')}`);
    return EMOJIS[name];
  },
  /** Which sets have this name: `path` for box({icon}) / iconRow() (installed in the project), `emoji` for icon.emoji(). */
  has(name: string): {path: boolean; emoji: boolean} {
    return {path: glyphOf(name) !== undefined, emoji: own(EMOJIS, name)};
  },
  /** The path icons this project installed. */
  get pathNames(): IconName[] { return installedNames(); },
  emojiNames: Object.keys(EMOJIS) as EmojiName[],
  /** Use this manifest (an object, or the text of a svg-diagram.icons.json) instead of looking for the file. `undefined` goes back to the file. */
  use(manifest: IconManifest | string | undefined): void {
    explicit = typeof manifest === 'string' ? parseManifest(manifest, 'icon.use()') : manifest;
  },
};

/** box({icon}) / iconRow(): the installed glyph, or a throw that says how to install it. */
export function resolveIcon(name: string, caller: string): IconGlyph {
  const g = glyphOf(name);
  if (g) return g;
  const have = installedNames();
  const where = findManifest() ?? `${MANIFEST_FILE} (none found from ${process.cwd()})`;
  throw new Error(`${caller}: icon "${name}" is not installed in ${where}${have.length ? ` — installed: ${have.join(', ')}` : ''}. Install one: svg-diagram icons add mdi:<icon>=${/^[A-Za-z][\w-]*$/.test(name) ? name : 'name'}  (find: svg-diagram icons search <word>)`);
}
