import {diagram, funnel} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'blue',title:'営業ファネル'}).add(funnel([{id:'visit',label:'訪問',value:1200},{label:'問い合わせ',value:420},{label:'商談',value:160},{id:'win',label:'成約',value:52}],{scale:'value',showRate:true}));; }
