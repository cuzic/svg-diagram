// Public API: a vertical stack of bands (caption, box, banner, spacer, raw,
// row, grid, connect, pyramid, curve, bars).
//
// Deliberately absent from every function signature: x, y, fill, stroke,
// font-family, and (on the normal path) font-size/height. That absence IS
// the constraint system — a caller cannot express an off-token color or a
// sub-14px font because there is no parameter that accepts one.

//
// This file is only the package entry point ("svg-diagram"): the builders live in lib/dsl/*.ts, one module per family, and
// are pure (no fs / child_process; test/core-purity.test.ts); lib/dsl-pure.ts is the part of this entry that a web page can bundle. lib/dsl/render.ts holds renderDiagram() / checkDiagram()
// and lib/dsl/io.ts the pieces that touch the disk (build(), image()). shared / defaults / wireframe-numbering are internal and not re-exported.

export * from './dsl-pure.ts';
export * from './dsl/io.ts';
export * from './dsl/render.ts';
export {closeMeasurer} from './measure.ts';
