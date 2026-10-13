import {concentric, diagram} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'blue',title:'多層防御'}).add(concentric([{id:'edge',label:'境界',description:'入口を守る'},{label:'アプリ',description:'権限を絞る'},{id:'data',label:'データ',description:'暗号化'}],{centre:'重要情報'}));; }
