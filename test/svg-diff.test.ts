import test from 'node:test';
import assert from 'node:assert/strict';

test('an inline figure (no width / height, same viewBox) is not a canvas-size change', async () => {
  const {explainChange} = await import('../lib/svg-diff.ts');
  const a = '<svg xmlns="http://www.w3.org/2000/svg" width="940" height="361" viewBox="0 0 940 361"><rect x="0" y="0" width="940" height="361"/></svg>';
  const b = a.replace(' width="940" height="361" viewBox', ' viewBox');
  const r = explainChange(a, b);
  assert.equal(r.visual, false, r.lines.join('|'));
  assert.ok(explainChange(a, b.replace('0 0 940 361', '0 0 940 400')).visual);
});
