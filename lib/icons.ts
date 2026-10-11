// The one place that lists the icon names. Two sets, looked up by the same names where both have one:
//   - ICON_PATHS (icon-paths.ts): SVG paths from Material Design Icons / Material Symbols, drawn as shapes by box({icon}) and
//     iconRow() — fixed look, colour from the tone tokens. Cannot go inside a string.
//   - EMOJIS: emoji for use inside text (`${icon.emoji('key')} 鍵の管理`) — the look depends on the viewer's emoji font. Every one
//     is inside tokens.ts's EMOJI_RE (so emit.ts wraps it in class="emoji") and in Noto Color Emoji (test/icons.test.ts checks
//     both). Emoji that need a U+FE0F selector (⚠️ ⚙️ ☁️ ✅ 🗄️) are left out: EMOJI_RE does not match the selector.
// Pictograms help memory, not understanding: use them in the one or two figures where the metaphor is the point.

import {ICON_PATHS} from './icon-paths.ts';

export {ICON_PATHS};
export type IconName = keyof typeof ICON_PATHS;

export const EMOJIS = {
  person: '🧑',
  people: '👥',
  document: '📄',
  folder: '📁',
  key: '🔑',
  lock: '🔒',
  bridge: '🌉',
  fence: '🚧',
  ladder: '🪜', // there is no staircase emoji: the ladder is the nearest "climb step by step" (the path set has `stairs`)
  idea: '💡',
  search: '🔍',
  tool: '🔧',
  globe: '🌐', // for "the network / cloud": ☁ is outside EMOJI_RE
  database: '💾', // for "storage": 🗄 needs a variation selector
  mail: '📧',
  warning: '🚨', // ⚠ needs a variation selector
  target: '🎯',
  link: '🔗',
} as const;
export type EmojiName = keyof typeof EMOJIS;

const own = (o: object, k: string): boolean => Object.hasOwn(o, k);

export const icon = {
  /** The emoji for use inside a string. Throws on a name the emoji set does not have (see `icon.has`). */
  emoji(name: EmojiName): string {
    if (!own(EMOJIS, name)) throw new Error(`icon.emoji(): unknown emoji icon "${name}" — one of ${Object.keys(EMOJIS).join(', ')}`);
    return EMOJIS[name];
  },
  /** Which sets have this name: `path` for box({icon}) / iconRow(), `emoji` for icon.emoji(). */
  has(name: string): {path: boolean; emoji: boolean} {
    return {path: own(ICON_PATHS, name), emoji: own(EMOJIS, name)};
  },
  pathNames: Object.keys(ICON_PATHS) as IconName[],
  emojiNames: Object.keys(EMOJIS) as EmojiName[],
};

/** box({icon}) / iconRow(): throws on an unknown path-icon name. */
export function assertIconName(name: string, caller: string): asserts name is IconName {
  if (!own(ICON_PATHS, name)) throw new Error(`${caller}: unknown icon "${name}" — one of ${Object.keys(ICON_PATHS).join(', ')}`);
}
