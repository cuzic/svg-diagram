// VitePress: `markdown: {config: svgDiagram()}` in .vitepress/config.ts — `![alt](./flow.diagram.ts)` in a page renders as the
// figure, inline (render: 'svg' or 'html'). It is the markdown-it plugin (svg-diagram/markdown-it) set up for VitePress: sources are
// resolved from the page (VitePress passes env.path), and editing a source — or a file it imports, or .svg-diagram.json — re-renders
// the page in `vitepress dev`. Each figure is a Vue `v-html` value (VitePress compiles a page as a Vue template: it would read `{{ }}`
// in a figure's text, drop its <style> from the client build, and not hydrate the same DOM).
import svgDiagramPlugin, {} from './markdown-it.js';
export default function svgDiagram(opts = {}) {
    return md => svgDiagramPlugin(md, { ...opts, vue: true });
}
