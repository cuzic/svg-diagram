import {bowtie, diagram} from 'svg-diagram';

// ボウタイ図: 中央が頂上事象（制御を失うこと）で、上にハザード（何を制御しているか）。左は脅威と、それを防ぐ予防バリア（脅威から順に）、
// 右は頂上事象が起きたあとに和らげる低減バリアと、その結果。流れはすべて左から右。バリアが 1 つも無い道は check が知らせる。
export default function define() {
  return diagram({theme: 'blue', title: '個人情報の漏えいのボウタイ図', rcaCheck: 'strict', sourceLine: '出典: 説明用の例'}).add(bowtie({
    hazard: '顧客の個人情報',
    top: '個人情報が外部に漏えいする',
    threats: [
      {label: '不正アクセス', barriers: ['多要素認証', 'アクセス権の最小化']},
      {label: '誤送信', barriers: ['送信前の宛先確認']},
    ],
    consequences: [
      {label: '顧客の信用の低下', barriers: ['速やかな公表と説明']},
      {label: '損害賠償', barriers: ['サイバー保険']},
    ],
  }, {id: 'bt', maxNodeW: 'auto'}));
}
