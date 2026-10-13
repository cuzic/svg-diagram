import {diagram, venn} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'blue',title:'必要な能力'}).add(venn([{name:'技術',id:'tech'},{name:'顧客理解',id:'customer'}],{overlaps:[{sets:['技術','顧客理解'],label:'価値'}],universe:'チーム'}));; }
