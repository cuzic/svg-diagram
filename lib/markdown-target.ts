// Which image targets are diagram sources: `flow.diagram.ts`, optionally `flow.diagram.ts#html` / `#svg` to pick the output
// for that one figure. Shared by `svg-diagram md` and the markdown-it / remark / VitePress plugins.
export type Render = 'svg' | 'html';

const TARGET = /^(.+\.diagram\.ts)(?:#(svg|html))?$/;

/** The source path and the per-figure output choice, or undefined when the target is not a diagram source (a URL, any other file). */
export function diagramTarget(target: string): {file: string; render?: Render} | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const m = TARGET.exec(target);
  return m ? {file: m[1], ...(m[2] ? {render: m[2] as Render} : {})} : undefined;
}

/** `dir/flow.diagram.ts` → `flow` */
export const figureName = (file: string): string => file.replace(/^.*[\\/]/, '').replace(/\.diagram\.ts$/, '');

/** Markdown HTML blocks end at a blank line, so the fragment must not contain one. */
export const noBlankLines = (s: string): string => s.replace(/\n\s*\n/g, '\n');
