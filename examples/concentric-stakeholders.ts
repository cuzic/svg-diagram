import {concentric, diagram} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'teal',title:'関係者の距離'}).add(concentric([{label:'社会'},{label:'顧客と取引先'},{label:'チーム'}],{order:'inner-first',labels:'side',centre:'利用者'}));; }
