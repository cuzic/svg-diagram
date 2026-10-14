import {test} from 'node:test';
import assert from 'node:assert/strict';
import {xmlProblems} from '../lib/xml-check.ts';

test('well-formed SVG passes', () => {
  assert.deepEqual(xmlProblems('<svg xmlns="http://www.w3.org/2000/svg"><!-- c --><g data-badge=""><text>a &amp; b &#x41;</text><path d="M0,0"/></g><style><![CDATA[a>b{}]]></style></svg>'), []);
});

test('what an <img> rejects is reported: valueless attribute, bare &, bad nesting, duplicate attribute, unclosed tag', () => {
  assert.match(xmlProblems('<svg><g data-badge></g></svg>')[0]!, /without a quoted value/);
  assert.match(xmlProblems('<svg><text>a & b</text></svg>')[0]!, /bare "&"/);
  assert.match(xmlProblems('<svg><g></svg>')[0]!, /closes <g>/);
  assert.match(xmlProblems('<svg a="1" a="2"/>')[0]!, /repeats the attribute/);
  assert.match(xmlProblems('<svg><g>')[0]!, /never closed/);
});
