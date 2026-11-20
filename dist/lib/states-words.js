const STATE = { who: 'stateDiagram()', diagram: 'a state diagram', node: 'state', edge: 'transition', prefix: 'states' };
const FLOW = { who: 'flowchart()', diagram: 'a flowchart', node: 'node', edge: 'arrow', prefix: 'flowchart' };
export const statesWords = (flavor) => flavor === 'flowchart' ? FLOW : STATE;
