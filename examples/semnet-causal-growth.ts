import {causalLoop, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'amber', title: '学習と成長の二つのループ'}).add(causalLoop([
    {id: 'practice', label: '練習量'}, {id: 'skill', label: '技能'}, {id: 'result', label: '成果'}, {id: 'fatigue', label: '疲労'},
  ], [
    {from: 'practice', to: 'skill', polarity: 'same'}, {from: 'skill', to: 'result', polarity: '+'},
    {from: 'result', to: 'practice', polarity: '+', delay: true},
    {from: 'practice', to: 'fatigue', polarity: '+'}, {from: 'fatigue', to: 'practice', polarity: 'opposite'},
  ], {direction: 'TB', height: 340}));
}
