import {diagram, funnel} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'amber',title:'候補の絞り込み'}).add(funnel([{label:'全候補'},{label:'一次選考'},{label:'最終候補'},{label:'採用'}],{scale:'even'}));; }
