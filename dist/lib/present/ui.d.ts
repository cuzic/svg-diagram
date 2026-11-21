export declare const ASSET_JS = "/assets/present.js", ASSET_CSS = "/assets/present.css";
/** The CSP of a slide SVG, the same wherever it is served (`serve`, the Worker, `svg-diagram site`'s _headers; ADR 0056 D3, ADR 0067 D8). */
export declare const SVG_CSP = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
/** The CSP of a page, but for frame-ancestors (which a <meta> CSP cannot carry): `serve` and the Worker add it in their header. */
export declare const PAGE_CSP_META = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'";
export declare const PAGE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
/**
 * Where a page finds its script and stylesheet, and the CSP it carries itself. `serve` and the Worker use the defaults (absolute paths, the
 * CSP in their header); `svg-diagram site` gives paths relative to the page and a <meta> CSP, as its files go to any static host (ADR 0067 D3, D8).
 */
export interface PageAssets {
    js: string;
    css: string;
    csp?: string;
}
export interface PageConfig {
    role: 'viewer' | 'presenter';
    /** How this page follows: Server-Sent Events plus POST (local), a WebSocket (Worker), or nothing: a static site's slides.json (ADR 0067 D4). */
    transport: 'sse' | 'ws' | 'static';
    /** The SSE or WebSocket URL (a path; the page makes a ws: / wss: URL of it). */
    events: string;
    /** static: the slides.json to read (relative to the page). */
    slides?: string;
    /** Where a presenter's messages (go, link, pointer) are POSTed (sse only). */
    go?: string;
    /** The print page (every slide, for the browser's print to PDF). */
    print?: string;
    /** Where a presenter reads the notes (JSON). */
    notes?: string;
    /** The viewer's URL and its QR code (an SVG), shown to the presenter; null where other devices cannot reach this server. */
    viewerUrl?: string | null;
    qrSvg?: string | null;
    /** A note under the QR (how to let other devices in). */
    qrNote?: string;
    /** The SSE warning: a browser opens at most 6 connections to one local server (HTTP/1.1). */
    sseLimit?: boolean;
    /** Where the presenter's page hands the token in its URL's hash (#token=…) for a cookie, before it connects (ADR 0056 D9, D13). */
    claim?: string;
    /** Where the page goes once the token is traded (the Worker's /p/<id>/t goes on to /p/<id>/presenter). */
    afterClaim?: string;
    /** The viewer's page on this server (opened by `p`). */
    viewerPath?: string;
}
/**
 * The viewer's page (ADR 0062): the slide filling the window, moved by the presenter while linked, and by the viewer too (keys, the bar,
 * a swipe, the wheel, the overview, a slide number); the bar shows where the presenter is and brings the viewer back there.
 */
export declare function viewerPage(title: string, cfg: PageConfig, assets?: PageAssets): string;
/** The presenter's page: the current and next slides, the notes, the timer and pace, linking, the laser, the count of viewers, the QR, the problems. */
export declare function presenterPage(title: string, cfg: PageConfig): string;
/** Every slide on its own 1280 × 720 page, for the browser's print (no notes). */
export declare function printPage(title: string, slides: readonly {
    url: string;
    text: string;
}[], assets?: PageAssets): string;
/** A deck on a static site's index (ADR 0067 D12): its page (`<slug>/`), title, number of slides, and its first slide (relative to the index). */
export interface SiteIndexDeck {
    href: string;
    title: string;
    slides: number;
    cover: string;
}
/** A static site's index (ADR 0067 D12): every deck, with its first slide as the picture. No script. */
export declare function siteIndexPage(title: string, decks: readonly SiteIndexDeck[], assets: {
    css: string;
    csp?: string;
}): string;
export declare const SITE_CSS = "*{box-sizing:border-box}html,body{margin:0}\nbody.site{background:#f6f6f4;color:#1c1c1c;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}\n.site main{max-width:1120px;margin:0 auto;padding:24px 16px 48px}\n.site h1{font-size:24px;margin:8px 0 20px}\n.decks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}\n.decks a{display:flex;flex-direction:column;gap:6px;color:inherit;text-decoration:none;background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px}\n.decks a:hover,.decks a:focus-visible{border-color:#2563eb;outline:none;box-shadow:0 0 0 2px #2563eb33}\n.decks img{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#fff;border:1px solid #eee}\n.decks .t{font-weight:600;line-height:1.4}.decks .n{color:#666;font-size:13px}\n@media (prefers-color-scheme:dark){body.site{background:#161616;color:#eee}.decks a{background:#222;border-color:#3a3a3a}.decks .n{color:#aaa}}\n";
export declare const PRESENT_CSS = "*{box-sizing:border-box}[hidden]{display:none!important}html,body{margin:0;height:100%}\nbody{background:#111;color:#eee;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}\nbody.viewer{overflow:hidden}\nbutton,.nav a{font:inherit;background:#333;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;text-decoration:none}\nbutton:focus-visible,.nav a:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}\n.stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}\n.zbox{position:relative;overflow:hidden;touch-action:none}\n.stage .zbox{width:100vw;max-height:100vh;aspect-ratio:16/9}\n@media (min-aspect-ratio:16/9){.stage .zbox{width:auto;height:100vh}}\n.zbox img{display:block;width:100%;height:100%;background:#fff;transition:opacity .18s;transform-origin:0 0;user-select:none;-webkit-user-drag:none}\nbody.zoomed .zbox{cursor:grab}body.zoomed.panning .zbox{cursor:grabbing}\n.zctl{display:inline-flex;gap:4px;margin-left:12px}.zctl button{font-size:15px;padding:6px 10px}\nimg.fading{opacity:.15}\n@media (prefers-reduced-motion:reduce){.zbox img{transition:none}}\n.spot{position:absolute;inset:0;pointer-events:none;z-index:3;transition:background .05s}\n.help{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;z-index:12;padding:16px}\n.helpbox{background:#1c1c1c;border:1px solid #444;border-radius:10px;padding:16px 20px;max-width:720px;max-height:90vh;overflow:auto;font-size:14px}\n.helpbox h2{margin:0 0 10px;font-size:18px}.helpbox p{margin:10px 0 0;color:#aaa;font-size:12px}\n.helpbox table{border-collapse:collapse;width:100%}.helpbox td{padding:3px 8px;border-top:1px solid #333;vertical-align:top}.helpbox td:first-child{white-space:nowrap;color:#93c5fd;font-family:ui-monospace,monospace}\n.helpbox th{text-align:left;padding:10px 8px 4px;color:#fbbf24;font-weight:600}\n#spotbtn[aria-pressed=true]{background:#7c3aed}\n.laser{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#ef4444;box-shadow:0 0 12px 4px #ef4444aa;pointer-events:none;z-index:4}\n.progress{position:fixed;left:0;right:0;bottom:0;height:3px;background:#0004;z-index:3}.progress div{height:100%;width:0;background:#60a5fa;transition:width .2s}\n.nav{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;background:#000c;padding:6px 8px;border-radius:10px;z-index:6;opacity:0;transition:opacity .2s;font-size:14px;max-width:calc(100vw - 16px);flex-wrap:wrap;justify-content:center}\n.nav.show,.nav:focus-within{opacity:1}\n.nav .pos{min-width:64px;text-align:center;font-variant-numeric:tabular-nums}\n.follow{background:#1d4ed8}.follow.off{background:#b45309}\n.status{position:fixed;right:12px;top:12px;padding:4px 10px;border-radius:12px;background:#b45309;color:#fff;font-size:13px;z-index:7}\n.status.down{background:#b91c1c}\n.hint{position:fixed;left:50%;top:24px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:8px;font-size:14px;z-index:7}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}\nbody.hide-cursor{cursor:none}\n.pgrid{display:grid;grid-template-columns:minmax(0,2fr) minmax(300px,1fr);gap:12px;height:100vh;padding:12px}\n.cur{display:flex;flex-direction:column;justify-content:center;gap:8px;min-width:0}\n.curwrap{position:relative;width:100%;aspect-ratio:16/9}\nbody.lasering .curwrap{cursor:crosshair}\n.pnav{display:flex;gap:8px;align-items:center;justify-content:center}.pnav button{font-size:18px;padding:8px 22px}.pnav .pos{min-width:80px;text-align:center;font-variant-numeric:tabular-nums;font-size:18px}\n.side{display:flex;flex-direction:column;gap:10px;min-height:0}\n.nextslide img{width:100%;aspect-ratio:16/9;background:#fff;opacity:.9}\n.label{font-size:12px;color:#aaa}\n.bar{display:flex;gap:8px;align-items:center;font-variant-numeric:tabular-nums;flex-wrap:wrap}\n.timer{font-size:24px;min-width:72px}.dur{font-size:13px;color:#ccc}.dur input{width:56px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;padding:2px 4px}\n#clock{margin-left:auto;font-size:18px}\n#link.on{background:#1d4ed8}#laserbtn[aria-pressed=true]{background:#b91c1c}\n.pace{position:relative;height:8px;background:#222;border-radius:4px;overflow:hidden}.pace div{position:absolute;left:0;top:0;bottom:0}\n#pacetime{background:#555;width:0}#paceslide{background:#22c55e;height:4px;top:2px;width:0}\n.pacenote{font-size:12px;color:#aaa;min-height:1em}.pacenote.late{color:#f87171}.pacenote.early{color:#60a5fa}\n.notes{flex:1;min-height:80px;overflow:auto;white-space:pre-wrap;font:16px/1.6 inherit;font-family:inherit;margin:0;background:#1c1c1c;padding:10px;border-radius:6px}\n.qr{display:flex;flex-direction:column;align-items:flex-start;gap:4px}.qr svg{width:132px;height:132px}\n.qrurl{font-size:12px;word-break:break-all;color:#ccc}.qrnote{font-size:12px;color:#fbbf24}\n.keys{font-size:11px;color:#888}\nbody.presenter .status{position:static}\n.problems{position:fixed;left:12px;right:12px;bottom:12px;max-height:40vh;overflow:auto;background:#450a0a;border:1px solid #f87171;color:#fee2e2;padding:10px;border-radius:8px;white-space:pre-wrap;font-size:13px;z-index:8}\n.overview{position:fixed;inset:0;background:#000e;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-content:start;gap:12px;padding:16px;z-index:10}\n.overview button{background:none;border:2px solid transparent;padding:0;cursor:pointer;color:#ccc;text-align:left;font-size:12px}\n.overview button.at{border-color:#60a5fa}.overview button.here{border-color:#f59e0b}.overview img{width:100%;aspect-ratio:16/9;background:#fff;display:block}\nbody.print{background:#fff}body.print img{display:block;width:1280px;height:720px;page-break-after:always;break-after:page}\n@page{size:1280px 720px;margin:0}\n@media (max-width:760px){.pgrid{grid-template-columns:1fr;height:auto}.pnav button{flex:1;font-size:22px;padding:14px}}\n";
/** The page script (ADR 0062): follows the server's state, lets a viewer move on their own, and on the presenter's page moves it. Plain ES2020, no modules. */
export declare const PRESENT_JS: string;
