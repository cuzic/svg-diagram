// A template: literal text with blanks `{id}`. `{{` and `}}` are the braces themselves.
export type TemplatePart = {lit: string} | {slot: string};

export const COMIC_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Splits a template into literals and blanks. Throws on a brace that is neither a blank nor an escaped brace. */
export function parseTemplate(tpl: string, who = 'comic()'): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let lit = '';
  for (let i = 0; i < tpl.length; i++) {
    const c = tpl[i] as string;
    if (c === '{' && tpl[i + 1] === '{') { lit += '{'; i++; }
    else if (c === '}' && tpl[i + 1] === '}') { lit += '}'; i++; }
    else if (c === '{') {
      const close = tpl.indexOf('}', i);
      const id = close < 0 ? '' : tpl.slice(i + 1, close);
      if (!COMIC_ID.test(id)) throw new Error(`${who}: "${tpl}" has a "{" that is not a blank {id} (ids use letters, digits, _ and -; write {{ for the brace itself)`);
      if (lit) { parts.push({lit}); lit = ''; }
      parts.push({slot: id});
      i = close;
    } else if (c === '}') throw new Error(`${who}: "${tpl}" has a "}" with no blank before it (write }} for the brace itself)`);
    else lit += c;
  }
  if (lit) parts.push({lit});
  return parts;
}

/** The text of a template with every blank replaced by `fill(id)`. */
export const fillTemplate = (parts: readonly TemplatePart[], fill: (id: string) => string): string => parts.map(p => 'slot' in p ? fill(p.slot) : p.lit).join('');
export const slotIdsOf = (parts: readonly TemplatePart[]): string[] => parts.flatMap(p => 'slot' in p ? [p.slot] : []);
