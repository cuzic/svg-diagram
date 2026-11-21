import svgDiagramPlugin, { type SvgDiagramPluginOptions } from './markdown-it.ts';
export type { SvgDiagramPluginOptions };
export default function svgDiagram(opts?: Omit<SvgDiagramPluginOptions, 'vue'>): (md: Parameters<typeof svgDiagramPlugin>[0]) => void;
