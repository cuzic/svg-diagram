import {caption, connect, diagram, group, node, row} from 'svg-diagram';

// Web サービスの構成図: アイコンを大きく置いて名前を下に付ける node() を、group()（ネットワークの境界）と connect()（線）でつなぐ。
// アイコンは icons add で入れたもの（このリポジトリでは carbon の汎用アイコン）。公式アイコン集は `icons add-pack` で入れる。
// 線は `id:right` のように辺を指す（node の左・右・上はアイコンに、下はラベルの下に付く）。
export default function define() {
  return diagram({theme: 'blue', title: 'Web サービスの構成'}).add(
    caption('利用者から、ロードバランサー、2 つのゾーンのアプリ、データベースまで', {tone: 'muted'}),
    row([
      node({id: 'user', icon: 'user', label: '利用者', sub: 'ブラウザ', col: 3, span: 3}),
      node({id: 'dns', icon: 'dns', label: 'DNS', sub: 'example.com', col: 7, span: 3}),
    ], {cols: 12}),
    group([
      row([
        node({id: 'fw', icon: 'fw', label: 'ファイアウォール', sub: '443 のみ', col: 3, span: 3}),
        node({id: 'lb', icon: 'lb', label: 'ロードバランサー', sub: '2 ゾーンに分散', col: 7, span: 3}),
      ], {cols: 12}),
      row([
        group([node({id: 'app1', icon: 'vm', label: 'アプリ 1', sub: '10.0.1.10'})], {title: 'ゾーン A', dashed: true}),
        group([node({id: 'app2', icon: 'vm', label: 'アプリ 2', sub: '10.0.2.10'})], {title: 'ゾーン B', dashed: true}),
      ], {cols: [6, 6], gap: 32}),
      row([node({id: 'db', icon: 'sqldb', label: 'データベース', sub: 'プライマリ', col: 5, span: 4})], {cols: 12}),
    ], {title: 'VPC 10.0.0.0/16'}),
    connect('user:right', 'dns:left'),
    connect('dns:bottom', 'fw:top', {route: 'elbow'}),
    connect('fw:right', 'lb:left'),
    connect('lb:bottom', 'app1:top', {route: 'elbow', bend: 0.15}),
    connect('lb:bottom', 'app2:top', {route: 'elbow', bend: 0.15}),
    connect('app1:bottom', 'db:top', {route: 'elbow', bend: 0.85}),
    connect('app2:bottom', 'db:top', {route: 'elbow', bend: 0.85}),
  );
}
