import {chevron, diagram} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'teal',title:'問い合わせ対応'}).add(chevron([{label:'受付'},{label:'内容の分類'},{label:'担当者が回答'}],{direction:'vertical',first:'chevron',width:420}));; }
