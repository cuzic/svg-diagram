// Two engines can only be compared when Chromium draws with the file the font engine reads. Asks Chromium (CDP) which platform font it
// used for a Latin sample, and checks that family is one the font file carries.
import {execFileSync} from 'node:child_process';
import {getBrowser} from '../../lib/measure.ts';
import {resolveFontFile} from '../../lib/font-metrics.ts';
import {FONT_STACKS} from '../../lib/tokens.ts';
import type {FontFamily} from '../../lib/types.ts';

export async function chromiumUsesOurFont(family: FontFamily, weight: number): Promise<boolean> {
  const file = resolveFontFile(family, weight);
  if (!file) return false;
  let families: string[];
  try { families = execFileSync('fc-query', ['-f', '%{family}\n', file.file], {encoding: 'utf8'}).toLowerCase().split(/[,\n]/).map(s => s.trim()).filter(Boolean); }
  catch { return false; }
  const page = await (await getBrowser()).newPage();
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg"><text id="t" y="50" font-family="${FONT_STACKS[family]}" font-size="16" font-weight="${weight}">Inventory</text></svg>`);
    const {root} = await cdp.send('DOM.getDocument', {depth: 0});
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: '#t'});
    const {fonts} = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
    return fonts.length > 0 && fonts.every(f => families.includes(f.familyName.toLowerCase()));
  } finally { await page.close(); }
}

