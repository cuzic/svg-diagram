import {dependencyNetwork, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'サービスの依存関係'}).add(dependencyNetwork([
    {id: 'web', label: 'Web アプリ', kind: 'app'}, {id: 'api', label: 'API', kind: 'service'},
    {id: 'auth', label: '認証', kind: 'service'}, {id: 'db', label: '顧客 DB', kind: 'data'},
  ], [
    {from: 'web', to: 'api', type: 'uses', weight: 3}, {from: 'api', to: 'auth', type: 'depends', weight: 2},
    {from: 'api', to: 'db', type: 'depends', weight: 5}, {from: 'auth', to: 'db', type: 'relates'},
  ], {nodeKinds: {app: 'アプリ', service: 'サービス', data: 'データ'}, edgeTypes: {uses: '利用', depends: '依存', relates: '関連'}, height: 260}));
}
