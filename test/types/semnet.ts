import {box, causalLoop, connect, dependencyNetwork, diagram, pert} from '../../lib/dsl.ts';

export function semnetTypes(): void {
  const d = diagram({theme: 'blue'});
  d.add(pert([{id: 'a', label: 'A', duration: 1}, {id: 'b', label: 'B', duration: 1, predecessors: ['a']}], {id: 'p'}), box({id: 'n'}), connect('n', 'a'), connect('p', 'b'));
  d.add(causalLoop([{id: 'demand', label: '需要'}], [{from: 'demand', to: 'demand', polarity: '+'}]), box({id: 'n2'}), connect('n2', 'demand'));
  d.add(dependencyNetwork([{id: 'api', label: 'API'}], [], {id: 'deps'}), box({id: 'n3'}), connect('n3', 'api'), connect('deps', 'n3'));
  // @ts-expect-error: not a semantic-network node id
  d.add(pert([{id: 'known', label: 'Known', duration: 1}]), box({id: 'n4'}), connect('n4', 'missing'));
}
