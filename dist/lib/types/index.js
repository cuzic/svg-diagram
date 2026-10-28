// Domain types for svg-diagram (types only: nothing in this file exists at runtime).
//
// Layers, in the order data flows through them:
//   1. DSL input   — XxxOpts (what a caller passes to diagram() / box() / wf.col() ...)
//   2. Bands       — Band: what the DSL constructors return (a vertical stack, discriminated on `type`)
//   3. Laid out    — LaidOutBand / LaidOutDiagram: layout.ts output, every band has x/y/w/h
//   4. Verdicts    — Finding / Verdict / FitReport: rules.ts, verify.ts, fit.ts output
//
// Conventions:
//   * Laid-out objects are MUTABLE on purpose (layout.ts creates a band, then fixes h / y / tagBox.y
//     once siblings are known). Do not mark their fields readonly.
//   * Optional (`?`) means "the DSL constructor may leave this undefined", not "may be missing at runtime
//     after defaults were applied" — a constructor that defaults a field (e.g. row().gap) returns it required.
//   * Colours are never raw strings in the DSL: they are token keys (TextTone / BoxTone / ColorKey).
//
// This directory is split by domain; index.ts re-exports everything and holds the Band / LaidOut unions.
export * from './core.js';
export * from './text-bands.js';
export * from './containers.js';
export * from './figures.js';
export * from './people-dots.js';
export * from './math.js';
export * from './bars.js';
export * from './timeline.js';
export * from './diagrams.js';
export * from './image.js';
export * from './sequence-table-swimlane.js';
export * from './wireframe.js';
export * from './wireframe-nodes.js';
export * from './verdicts.js';
export * from './project.js';
