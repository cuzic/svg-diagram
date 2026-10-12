import {diagram, tree} from 'svg-diagram';

// 組織図: 配置は自動(親は子の中央、同じ階層は揃う)。id を付けた部署は connect() の端点にもなる。
export default function define() {
  return diagram({theme: 'blue', title: '開発組織の体制', sourceLine: '出典: 社内の組織規程(例)'}).add(
    tree({
      label: '開発本部', sub: '本部長', tone: 'accent',
      children: [
        {label: 'プラットフォーム部', sub: '部長', children: [{label: 'インフラ'}, {label: 'SRE'}, {label: 'セキュリティ', tone: 'muted'}]},
        {label: 'プロダクト部', sub: '部長', children: [{label: 'Web'}, {label: 'モバイル'}]},
        {label: 'データ部', sub: '部長', children: [{label: '分析基盤'}]},
      ],
    }),
  );
}
