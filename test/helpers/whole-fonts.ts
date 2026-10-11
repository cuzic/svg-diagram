// The layout's own font files, whole (what resvg was given before the figure's fonts were cut): the reference for "the cut changes nothing".
import {resolveFontFile} from '../../lib/font-metrics.ts';

export function fontFilesForTest() {
  const found = (['sans', 'mono', 'emoji'] as const).flatMap(f => [400, 700].map(w => ({f, r: resolveFontFile(f, w)}))).filter(x => x.r);
  return {files: [...new Set(found.map(x => x.r!.file))], sans: found.find(x => x.f === 'sans')?.r?.name ?? ''};
}
