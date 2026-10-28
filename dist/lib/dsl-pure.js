// The package entry minus everything that touches the disk or a process (build(), image(), math(), renderDiagram(), checkDiagram(), the
// rendering shell): the builders, diagram() and the public types. lib/dsl.ts re-exports it, and the browser entry (lib/web.ts) builds on
// it. A file reachable from here may not import node:* (test/web-entry.test.ts). ADR 0045.
export { diagram } from './dsl/diagram.js';
export * from './dsl/text-bands.js';
export * from './dsl/sequence-table-swimlane.js';
export * from './dsl/wireframe.js';
export * from './dsl/containers.js';
export * from './dsl/connect.js';
export * from './dsl/figures.js';
export * from './dsl/people-dots.js';
export * from './dsl/charts.js';
export * from './dsl/charts-stats.js';
export * from './dsl/bars.js';
export * from './dsl/qc-semantic.js';
export * from './dsl/diagrams.js';
export * from './dsl/timeline-gantt.js';
export { wf } from './wireframe.js';
export { icon } from './icon-registry.js';
export { versus } from './versus.js';
export { steps } from './steps.js';
export { hero } from './hero.js';
export { em } from './rich.js';
export { tally } from './qc-table.js';
export { analyzeCriticalPath, analyzeCausalLoops } from './semnet-analysis.js';
