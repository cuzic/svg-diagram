import net from 'node:net';
import {spawn} from 'node:child_process';
import {must} from './must.ts';

const SLIDE_W = 980, SLIDE_H = 552;
// Content may extend to here; matches what check-slide-overflow.ts tolerates
// (bottom 6% band is 519px; content boxes may end at 520 with their own margin).
const BOTTOM_LIMIT = 520;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => { const {port} = s.address() as net.AddressInfo; s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

async function withDevServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const port = await freePort();
  const child = spawn('npx', ['slidev', 'slides.md', '--port', String(port)], {detached: true, stdio: 'ignore'});
  try {
    const base = `http://localhost:${port}`;
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('slidev dev server did not start within 90s');
      try { if ((await fetch(base + '/')).ok) break; } catch { /* not up yet */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    return await fn(base);
  } finally {
    try { process.kill(-must(child.pid)); } catch { /* already gone */ }
  }
}

// name.svg, or one of its click stages name.revealN.svg (every stage has the same size); CSS can't match \d+, so the stage suffix is matched by prefix
export function imgSelector(scope: string, svg: string): string {
  const stem = svg.replace(/\.svg$/, '');
  return `${scope} img[src$="/svg/${svg}"], ${scope} img[src*="/svg/${stem}.reveal"][src$=".svg"], ${scope} img[src^="data:image/svg"]`;
}

async function measure(base: string, index: number, svg: string) {
  const {launchChromium} = await import('./browser.ts');
  const browser = await launchChromium();
  try {
    const p = await browser.newPage({viewport: {width: SLIDE_W, height: SLIDE_H}});
    // Vite may inline a small SVG as a data: URI, so match by path first and
    // fall back to "the one SVG image in the slide".
    // The dev DOM holds many slides at once; scope to this slide's page node.
    const scope = `.slidev-page-${index} .slidev-layout`;
    const sel = imgSelector(scope, svg);
    await p.goto(`${base}/${index}?clicks=99`);
    await p.waitForSelector(sel, {state: 'attached', timeout: 60000});
    if ((await p.locator(sel).count()) !== 1) throw new Error(`slide ${index}: expected exactly one SVG <img> matching ${svg}, found ${await p.locator(sel).count()}`);
    await p.waitForTimeout(800); // fonts + v-click settle
    return await p.evaluate(({sel, limit}) => {
      const img = document.querySelector(sel) as HTMLElement; // existence was checked above (exactly one match)
      // biome-ignore lint/style/noNonNullAssertion: runs inside the page (page.evaluate), where nothing can be imported
      const layout = img.closest('.slidev-layout')!;
      const cs = getComputedStyle(img);
      const margins = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      const prevDisplay = img.style.display;
      img.style.display = 'none';
      // in-flow content only: absolutely-positioned badges don't consume height
      let bottom = 0;
      for (const el of layout.children) {
        const pos = getComputedStyle(el).position;
        if (pos === 'absolute' || pos === 'fixed') continue;
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
      }
      img.style.display = prevDisplay;
      // biome-ignore lint/style/noNonNullAssertion: runs inside the page (page.evaluate), where nothing can be imported
      const parent = img.parentElement!.getBoundingClientRect();
      // biome-ignore lint/style/noNonNullAssertion: runs inside the page (page.evaluate), where nothing can be imported
      const pcs = getComputedStyle(img.parentElement!);
      const contentWidth = parent.width - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
      return {maxHeight: Math.floor(limit - bottom - margins), contentWidth: Math.floor(contentWidth)};
    }, {sel, limit: BOTTOM_LIMIT});
  } finally {
    await browser.close();
  }
}

export function measureSlideBudget(index: number, svg: string) {
  return withDevServer(base => measure(base, index, svg));
}
