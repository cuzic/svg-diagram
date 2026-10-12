// The icon names a figure can use, in two kinds:
//   - path icons: SVG paths the *project* installed (`svg-diagram icons add mdi:key-variant=key` → svg-diagram.icons.json), drawn
//     as shapes by box({icon}) and iconRow(), coloured by the tone tokens. svg-diagram ships none of them: icons come from free
//     sets (Material Design Icons, Material Symbols, ...), each with its own licence, which the project then holds. Cannot go
//     inside a string.
//   (the lookup of the installed ones, which reads the project's file, is in icon-registry.ts — this file is part of the pure core)
//   - EMOJIS: emoji for use inside text (`${icon.emoji('key')} 鍵の管理`) — the look depends on the viewer's emoji font. Every one
//     is inside tokens.ts's EMOJI_RE (so emit.ts wraps it in class="emoji") and in Noto Color Emoji (test/icons.test.ts checks
//     both). Emoji that need a U+FE0F selector (⚠️ ⚙️ ☁️ ✅ 🗄️) are left out: EMOJI_RE does not match the selector.
// Pictograms help memory, not understanding: use them in the one or two figures where the metaphor is the point.

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

/** The pure part of `icon` (emoji); icon-registry.ts adds the installed path icons to it. */
export const emojiIcons = {
  /** The emoji for use inside a string. Throws on a name the emoji set does not have (see `icon.has`). */
  emoji(name: EmojiName): string {
    if (!own(EMOJIS, name)) throw new Error(`icon.emoji(): unknown emoji icon "${name}" — one of ${Object.keys(EMOJIS).join(', ')}`);
    return EMOJIS[name];
  },
  emojiNames: Object.keys(EMOJIS) as EmojiName[],
};
export {own};
