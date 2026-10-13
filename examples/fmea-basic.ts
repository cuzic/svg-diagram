import {diagram, fmea} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '搬送設備 FMEA'}).add(fmea([
    {item: '駆動軸', mode: '摩耗', effect: '搬送停止', cause: '潤滑不足', action: '定期給油', s: 8, o: 5, d: 4, after: {s: 8, o: 2, d: 2}},
    {item: 'センサー', mode: '誤検知', effect: '一時停止', cause: '汚れ', action: '清掃周期短縮', s: 5, o: 4, d: 3, after: {s: 5, o: 2, d: 2}},
  ], {title: '故障モード影響解析', sort: 'rpn', dense: true}));
}
