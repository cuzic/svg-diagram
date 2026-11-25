import {diagram, mindmap} from 'svg-diagram';

// 子の項目の `edge` で、親とつなぐ線の色と線種を変えられる。賛成の理由は accent の実線、反対の理由は danger の破線。
// 線の意味(青 = 賛成、赤の破線 = 反対)は図を読む人が決めるもので、凡例は必要なら legend() を手で書く。
const pro = {tone: 'accent', line: 'solid'} as const;
const con = {tone: 'danger', line: 'dashed'} as const;

const topic = {
  label: '新しい勤怠システムを導入するか', tone: 'accent' as const,
  children: [
    {label: '費用が下がる', edge: pro, children: [{label: '保守費が半分になる', edge: pro}, {label: '紙の集計がなくなる', edge: pro}]},
    {label: '現場の手間が減る', edge: pro},
    {label: '移行に時間がかかる', edge: con, children: [{label: '教育の時間が要る', edge: con}, {label: '旧データの整理'}]},
    {label: '契約の縛りが長い', edge: con},
  ],
};

export default function define() {
  return diagram({theme: 'blue', title: '導入するか(賛成と反対の枝)'}).add(mindmap(topic, {layout: 'right'}));
}
