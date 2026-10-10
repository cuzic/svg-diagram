// A throwaway slide project in `dir` (slides.md + pages/p.md) with a cached budget for p.md's "見出し" slide,
// so renderDiagram({budget: 'cacheOnly'}) finds it without a dev server.
import fs from 'node:fs';
import path from 'node:path';
import {cacheKey} from '../../lib/slide-budget.ts';

export function slideCacheKeyForTest(dir: string, result: {maxHeight: number; contentWidth: number}): void {
  fs.mkdirSync(path.join(dir, 'pages'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'slides.md'), '---\nsrc: ./pages/p.md\n---\n');
  fs.writeFileSync(path.join(dir, 'pages/p.md'), '# 見出し\n\n<img src="/svg/p.svg">\n');
  fs.mkdirSync(path.join(dir, '.cache'), {recursive: true});
  const key = `${path.relative('.', 'pages/p.md')}#見出し#p.svg`;
  fs.writeFileSync(path.join(dir, '.cache/slide-budget.json'), JSON.stringify({[key]: {hash: cacheKey('pages/p.md', '見出し', 'p.svg'), result: {...result, index: 1, cached: true}, measuredAt: 'now'}}));
}
