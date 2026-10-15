// The viewer's CSS and script as `buildDeck` embeds them (ADR 0018). The contract is `viewerAssets(opts): {css, js}`.
// This is the minimal form that unit D (`svg-diagram deck`) needs on its own: slides one under the other — what the document
// looks like without script, in print, and when a Content-Security-Policy stops the script — and an empty script block. Unit C replaces
// the body of this file with the real viewer (assets read from lib/deck-viewer/*), keeping the signature.

export interface ViewerOptions {
  /** Reserved for the real viewer (overview columns etc. are passed to buildDeck as `cols`). */
  [key: string]: unknown;
}

const CSS = `:root { color-scheme: light dark }
body { margin: 0; font-family: system-ui, sans-serif }
#deck { display: block }
.slide { box-sizing: border-box; padding: 16px; background: #ffffff; margin: 0 0 16px }
.slide-dark { background: #1a1a1a }
.slide svg { display: block; max-width: 100%; height: auto; margin: 0 auto }
@media print { .slide { margin: 0; padding: 0; break-after: page } }
`;

const JS = '/* the viewer script: unit C (state.js + viewer.js) */\n';

export function viewerAssets(_opts: ViewerOptions = {}): {css: string; js: string} {
  return {css: CSS, js: JS};
}
