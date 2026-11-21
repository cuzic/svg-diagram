// usage: U6='{"proxyScan":3000}' node proxy-scan.ts <root>   the order search's log for the fixture (needs the probe: lib/u6-probe.ts)
const root = process.argv[2]!;
await import(root + '/test/helpers/strict-width.ts');
const {checkDiagram, closeMeasurer} = await import(root + '/lib/dsl.ts');
const {crtReportShape} = await import(root + '/test/fixtures/crt-report-shape.ts');
const G: any = globalThis; G.__u6log.length = 0;
await checkDiagram(crtReportShape());
const l = G.__u6log.at(-1); console.log(JSON.stringify({base: l.base, best: l.best, first: l.first, exit: l.exit, tried: l.tried, laid: l.laid, proxySkip: l.proxySkip, scan: l.scan}, null, 1));
closeMeasurer();
