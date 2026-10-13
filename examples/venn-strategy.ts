import {diagram, venn} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'amber',title:'戦略の焦点'}).add(venn([{name:'顧客'},{name:'自社'},{name:'競合'}],{overlaps:[{sets:['顧客','自社'],label:'提供価値'},{sets:['自社','競合'],label:'差別化'}],centre:'勝ち筋'}));; }
