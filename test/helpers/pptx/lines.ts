// What PowerPoint needs of a slide's lines (ADR 0027): no connector (p:cxnSp) with a custom geometry -- PowerPoint refuses or repairs those --
// and a freeform line (p:sp with an open path) carries a text body, as PowerPoint saves one, and nothing only a connector has.

/** The problems of a slide's XML, one line each (empty when none). */
export function lineShapeProblems(slideXml: string): string[] {
  const problems: string[] = [];
  const name = (s: string): string => /<p:cNvPr id="(\d+)" name="([^"]*)"/.exec(s)?.slice(1).join(' ') ?? '?';
  for (const m of slideXml.matchAll(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g)) if (m[0].includes('<a:custGeom>')) problems.push(`p:cxnSp with a:custGeom: ${name(m[0])}`);
  for (const m of slideXml.matchAll(/<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g)) {
    if (!/<a:path [^>]*fill="none"/.test(m[0])) continue;
    if (!m[0].includes('<p:txBody>')) problems.push(`freeform p:sp without a text body: ${name(m[0])}`);
    if (/<a:(?:stCxn|endCxn)\b/.test(m[0])) problems.push(`freeform p:sp with a connector's glue: ${name(m[0])}`);
  }
  return problems;
}
