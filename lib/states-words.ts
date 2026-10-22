// The words a state diagram and a flowchart (a state diagram with decisions, ADR 0041) use for the same things in messages.
export type StatesFlavor = 'flowchart' | undefined;
export interface StatesWords {who: string; diagram: string; node: string; edge: string; prefix: string}
const STATE: StatesWords = {who: 'stateDiagram()', diagram: 'a state diagram', node: 'state', edge: 'transition', prefix: 'states'};
const FLOW: StatesWords = {who: 'flowchart()', diagram: 'a flowchart', node: 'node', edge: 'arrow', prefix: 'flowchart'};
export const statesWords = (flavor: StatesFlavor): StatesWords => flavor === 'flowchart' ? FLOW : STATE;
