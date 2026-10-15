// Confining a <style>'s rules to one figure: every selector gets `#<pre> ` in front, so `text { … }` only reaches the text inside `#<pre>`.
// Shared by markdown-target.inlineSvg (one figure in a page) and deck-html (many figures in one document).

/** `css` with `#<pre> ` put before every selector of every top-level rule (a selector list gets it on each member). */
export function scopeRules(css: string, pre: string): string {
  return css.replace(/(^|\})\s*([^{}@]+)\{/g, (_m, a: string, sel: string) => `${a}\n#${pre} ${sel.split(',').map(x => x.trim()).join(`, #${pre} `)} {`);
}
