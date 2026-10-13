import {cycle, diagram} from '../lib/dsl.ts';
export default function define() { return diagram({theme:'teal',title:'学習サイクル'}).add(cycle([{label:'観察'},{label:'仮説'},{label:'実験'},{label:'計測'},{label:'共有'}],{direction:'ccw',centre:'学び'}));; }
