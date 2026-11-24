import {MIN_FONT_SIZE} from './tokens.ts';
import type {SlideCanvas} from './types/core.ts';
import type {Finding} from './types/verdicts.ts';

export function canvasFindings(canvas: SlideCanvas, min: number, contentHeight: number | undefined): Finding[] {
  const out: Finding[] = [];
  if (canvas.minText < MIN_FONT_SIZE) out.push({rule: 'font-floor-lowered', severity: 'info', message: `文字の下限を ${MIN_FONT_SIZE}px から ${canvas.minText}px に下げている(最小の文字 ${min}px)。キャンバスは 1:1 で読まれる前提。投影には向かない`});
  if (min < canvas.minText) out.push({rule: 'slide-min-text', severity: 'warn', message: `最小の文字が ${min}px。スライド用キャンバスは ${canvas.minText}px 以上(その文字を大きくするか、減らす)`});
  if (contentHeight !== undefined && contentHeight > canvas.height) out.push({rule: 'slide-canvas-overflow', severity: 'warn', message: `内容の高さ ${contentHeight}px が、キャンバスの高さ ${canvas.height}px を超える。行・文字を減らすか、図を分ける`});
  return out;
}
