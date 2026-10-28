// The viewer's CSS and script as `buildDeck` embeds them (ADR 0018, unit C). The contract is `viewerAssets(opts): {css, js}`.
// The assets are plain files read from lib/deck-viewer/ (state.js, viewer.js, viewer.css) — not TS functions turned into text with
// Function#toString, which breaks once tsc has rewritten them. The files sit next to this one in dist/ too (the build copies them).
// The script is state.js and viewer.js joined into one <script>: the `export` keywords and viewer.js's one `import` line are cut out.
import fs from 'node:fs';
const asset = (name) => fs.readFileSync(new URL(`./deck-viewer/${name}`, import.meta.url), 'utf8');
/** The one script: state.js (its `export`s dropped) followed by viewer.js (its `import` of state.js dropped), in a function scope. Exported for the tests. */
export function joinScript(state, viewer) {
    const s = state.replace(/^export (?=function|const|let)/gm, '');
    const v = viewer.replace(/^import\s[^;]*from\s+'\.\/state\.js';?[ \t]*\r?\n/m, '');
    if (/^\s*(import|export)\s/m.test(s + v))
        throw new Error('the viewer script must be free of import / export once joined');
    return `(function () {\n'use strict';\n${s}\n${v}})();\n`;
}
export function viewerAssets(_opts = {}) {
    return { css: asset('viewer.css'), js: joinScript(asset('state.js'), asset('viewer.js')) };
}
