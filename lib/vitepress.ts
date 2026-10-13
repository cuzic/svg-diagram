// VitePress: `markdown: {config: svgDiagram()}` in .vitepress/config.ts — `![alt](./flow.diagram.ts)` in a page renders as the
// figure, inline (render: 'svg' or 'html'). It is the markdown-it plugin (svg-diagram/markdown-it) set up for VitePress: sources are resolved from the page
// (VitePress passes env.path), and editing a source — or a file it imports — re-renders the page in `vitepress dev`.
import svgDiagramPlugin, {type SvgDiagramPluginOptions} from './markdown-it.ts';

export type {SvgDiagramPluginOptions};

export default function svgDiagram(opts: SvgDiagramPluginOptions = {}): (md: Parameters<typeof svgDiagramPlugin>[0]) => void {
  return md => svgDiagramPlugin(md, opts);
}
