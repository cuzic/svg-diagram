// Preloaded (NODE_OPTIONS=--import) into a `build` run: the lint-svg.ts child process it spawns fails, so a test can see
// what `build` leaves behind when the lint pass after writing fails (ADR 0013, E1-5).
if (/lint-svg\.(ts|js)$/.test(process.argv[1] ?? '')) {
  console.error('lint-svg (stub): 1 error');
  process.exit(1);
}
