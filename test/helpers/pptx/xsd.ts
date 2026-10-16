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

/** Download and unpack the schemas (verifying the archive's SHA-256). Needs network and `unzip`. */
export async function fetchXsd(): Promise<void> {
  const zip = Buffer.from(await (await fetch(URL_PART4)).arrayBuffer());
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

/** Problems xmllint finds in a slide (empty when it validates against pml.xsd). */
export function slideSchemaProblems(slideXml: string): string[] {
  try {
    execFileSync('xmllint', ['--noout', '--schema', path.join(XSD_DIR, 'pml.xsd'), '-'], {input: slideXml, stdio: ['pipe', 'ignore', 'pipe']});
    return [];
  } catch (error) {
    const stderr = String((error as {stderr?: Buffer}).stderr ?? error);
    return stderr.split('\n').filter(line => line && !/fails to validate$/.test(line)).slice(0, 5);
  }
}
