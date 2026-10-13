import {cycle, diagram} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'blue',title:'PDCA'}).add(cycle([{id:'plan',label:'Plan'},{id:'do',label:'Do'},{id:'check',label:'Check'},{id:'act',label:'Act'}],{centre:'継続改善'}));; }
