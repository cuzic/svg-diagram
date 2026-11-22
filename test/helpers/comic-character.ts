// A made-up artist's character for the comic tests: a 200 x 240 box (not square), the head circle off-centre, a gradient (so its id must be rewritten).
import type {CharacterManifest} from '../../lib/types/comic.ts';

const body = (mouth: string) => '<defs><linearGradient id="cloth"><stop offset="0" stop-color="#4a6fa5"/><stop offset="1" stop-color="#2d4a73"/></linearGradient></defs>'
  + '<rect x="30" y="140" width="140" height="100" fill="url(#cloth)" stroke="#222222" stroke-width="3"/>'
  + '<circle cx="100" cy="90" r="56" fill="#ffddbb" stroke="#222222" stroke-width="3"/>' + mouth;
export const ARTIST: CharacterManifest = {
  id: 'colleague-a',
  name: '同僚',
  box: [0, 0, 200, 240],
  anchors: {head: {cx: 100, cy: 90, r: 56}, mouth: [100, 112], hand: [150, 190]},
  bubbleSides: ['top-left', 'top', 'top-right'],
  expressions: {
    neutral: body('<path d="M85 112h30" fill="none" stroke="#222222" stroke-width="3"/>'),
    smile: body('<path d="M82 108q18 16 36 0" fill="none" stroke="#222222" stroke-width="3"/>'),
  },
  license: {spdx: 'CC-BY-4.0', author: 'An Example Artist', url: 'https://example.com/characters/colleague-a'},
};
