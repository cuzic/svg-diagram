import {diagram, qfd} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '静音掃除機 QFD'}).add(qfd(
    [{label: '吸引力が強い', importance: 5}, {label: '静か', importance: 5}, {label: '軽い', importance: 3}],
    ['吸込仕事率', '騒音値', '本体質量'],
    [['◎', '△', '○'], ['○', '◎', '△'], ['△', '○', '◎']],
    {title: '品質機能展開'},
  ));
}
