// The ECMA-376 transitional XML schemas (5th edition, Part 4), fetched once into .cache/ooxml-xsd/ and checked with xmllint:
// a slide that breaks the schema is the kind PowerPoint answers with "repair?", and this finds it without PowerPoint.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const URL_PART4 = 'https://ecma-international.org/wp-content/uploads/ECMA-376-4_5th_edition_december_2016.zip';
const SHA_PART4 = 'bd25da1109f73762356596918bf5ff8b74a1331642dba5f1c1d1dfc6bed34ecd';
const SHA_XSD_ZIP = 'd34187520749998af306faf1b730e568b0ca6d88ad24638a407c0a9bb4ca04fc';
export const XSD_DIR = path.resolve('.cache/ooxml-xsd');
const sha = (data: Buffer): string => crypto.createHash('sha256').update(data).digest('hex');

export const hasXmllint = (): boolean => { try { execFileSync('xmllint', ['--version'], {stdio: 'ignore'}); return true; } catch { return false; } };
export const hasXsd = (): boolean => fs.existsSync(path.join(XSD_DIR, 'pml.xsd'));

/** The body of `url`, tried twice: an HTTP error or a network failure is reported as such, not as a changed archive (a 403 page hashes wrong too). */
export async function download(url: string, get: typeof fetch = fetch, tries = 2): Promise<Buffer> {
  let last = '';
  for (let i = 0; i < tries; i++) {
    try {
      const res = await get(url, {signal: AbortSignal.timeout(60_000)});
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = `HTTP ${res.status} ${res.statusText}`;
    } catch (error) { last = String((error as Error).message ?? error); }
  }
  throw new Error(`could not download ${url} (${tries} tries): ${last}`);
}

/** Download and unpack the schemas (verifying the archive's SHA-256). Needs network and `unzip`. */
export async function fetchXsd(): Promise<void> {
  const zip = await download(URL_PART4);
  if (sha(zip) !== SHA_PART4) throw new Error('the ECMA-376 Part 4 archive changed (SHA-256 mismatch); check it and update xsd.ts');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ooxml-xsd-'));
  const outer = path.join(tmp, 'part4.zip');
  fs.writeFileSync(outer, zip);
  execFileSync('unzip', ['-q', '-o', outer, 'OfficeOpenXML-XMLSchema-Transitional.zip', '-d', tmp]);
  const inner = path.join(tmp, 'OfficeOpenXML-XMLSchema-Transitional.zip');
  if (sha(fs.readFileSync(inner)) !== SHA_XSD_ZIP) throw new Error('the transitional schema archive changed (SHA-256 mismatch)');
  fs.mkdirSync(XSD_DIR, {recursive: true});
  execFileSync('unzip', ['-q', '-o', inner, '-d', XSD_DIR]);
  fs.rmSync(tmp, {recursive: true, force: true});
}

/** Skip a schema check only off CI: under CI (which installs xmllint and the schemas) a missing tool or schema fails the check instead of hiding it. */
export const schemaCheckSkipped = (): boolean => !process.env['CI'] && !(hasXmllint() && hasXsd());

/** Problems xmllint finds in a slide (empty when it validates against pml.xsd). */
export function slideSchemaProblems(slideXml: string): string[] { return schemaProblems(slideXml, 'pml.xsd'); }

/**
 * Problems in every part of a .pptx package that the downloaded schemas cover: each `ppt/**.xml` against pml.xsd, `docProps/app.xml` against
 * shared-documentPropertiesExtended.xsd. Not checked: `docProps/core.xml`, `[Content_Types].xml` and the `.rels` (their OPC schemas are in Part 2, not fetched).
 */
export function packageSchemaProblems(parts: readonly {name: string; text: string}[]): string[] {
  return parts.flatMap(({name, text: raw}) => {
    const text = name === 'ppt/presentation.xml' ? schemaOrderOfPresentation(raw) : raw;
    const xsd = name === 'docProps/app.xml' ? 'shared-documentPropertiesExtended.xsd' : name.startsWith('ppt/') && name.endsWith('.xml') ? 'pml.xsd' : null;
    return xsd ? schemaProblems(text, xsd).map(p => `${name}: ${p}`) : [];
  });
}

/**
 * presentation.xml with its slide list moved after the notes master list, the one deviation from pml.xsd the writer makes on purpose:
 * PowerPoint does not open a deck with notes whose presentation.xml has pml.xsd's order (sldMasterIdLst, notesMasterIdLst, sldIdLst; error
 * 0x80070570, seen with Microsoft 365 PowerPoint 16.0.20326 and a user's PowerPoint) and opens PptxGenJS's order (sldIdLst before notesMasterIdLst).
 * xmllint and the Open XML SDK both accept the schema's order. Only that order is forgiven: anything else in the part is still checked as written.
 */
export function schemaOrderOfPresentation(xml: string): string {
  const m = /(<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>)(<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>)/.exec(xml);
  return m ? xml.replace(m[0], (m[2] ?? '') + (m[1] ?? '')) : xml;
}

function schemaProblems(xml: string, xsd: string): string[] {
  try {
    execFileSync('xmllint', ['--noout', '--schema', path.join(XSD_DIR, xsd), '-'], {input: xml, stdio: ['pipe', 'ignore', 'pipe']});
    return [];
  } catch (error) {
    // a missing xmllint is not a problem of the XML: thrown, so a test that expects problems cannot pass without one
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('xmllint is not installed (apt install libxml2-utils)');
    const stderr = String((error as {stderr?: Buffer}).stderr ?? error);
    return stderr.split('\n').filter(line => line && !/fails to validate$/.test(line)).slice(0, 5);
  }
}
