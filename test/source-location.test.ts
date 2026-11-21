import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolveErrorLocation} from '../lib/source-location.ts';
import {locateError, locateSource} from '../lib/source-location-io.ts';
import {DIAGRAM_SOURCE, SourceRef, withSource} from '../lib/source-ref.ts';

const source = 'src/日本 語/図.ts';
const absoluteSource = `/project/${source}`;
const logical = {source, cwd: '/project', packageDir: '/package', realpath: (file: string) => file};
const at = (file: string, line: number, column: number) => ({file, line, column});

test('locateError: resolve the part, error stack and diagram in that order', () => {
  const file = 'test/source-location.test.ts';
  const stackAt = (line: number) => `Error\n    at ${import.meta.url}:${line}:5`;
  const error = (stack: string) => withSource(Object.assign(new Error(), {stack}), new SourceRef({stack: stackAt(30)}), DIAGRAM_SOURCE);
  const atPart = withSource(error(stackAt(20)), new SourceRef({stack: stackAt(10)}));
  const unresolvedPart = withSource(error(stackAt(20)), new SourceRef({stack: ''}));
  assert.deepEqual(locateError(atPart, file), {loc: at(file, 10, 5), via: []});
  assert.deepEqual(locateError(unresolvedPart, file), {loc: at(file, 20, 5), via: []});
  assert.deepEqual(locateError(error(''), file), {loc: at(file, 30, 5), via: []});
});

test('locateError: a spec-only mark falls through to the error stack and diagram', () => {
  const file = 'test/source-location.test.ts';
  const ref = new SourceRef(undefined, 'parts[0]');
  const stackAt = (line: number) => `Error\n    at ${import.meta.url}:${line}:5`;
  const error = (stack: string) => withSource(withSource(Object.assign(new Error(), {stack}), ref),
    new SourceRef({stack: stackAt(20)}), DIAGRAM_SOURCE);
  assert.deepEqual(locateSource(ref, file), {via: []});
  assert.deepEqual(locateError(error(stackAt(10)), file), {loc: at(file, 10, 5), via: []});
  assert.deepEqual(locateError(error(''), file), {loc: at(file, 20, 5), via: []});
});

test('source location: a stack header needs a caret, even if an error message ends in 16:9', () => {
  const stack = `Error: aspect must be 16:9\n    at define (${absoluteSource}:7:4)`;
  assert.deepEqual(resolveErrorLocation({stack}, logical), {loc: at(source, 7, 4), via: []});
});

test('source location: both plain and file URL headers take precedence over user frames', () => {
  for (const file of [source, absoluteSource, pathToFileURL(absoluteSource).href]) {
    const stack = `${file}:3\n  xx\n  ^^\nSyntaxError: bad`;
    const frames = [at(absoluteSource, 9, 5)];
    assert.deepEqual(resolveErrorLocation({stack, frames}, logical), {loc: at(source, 3, 3), via: []});
  }
});

test('source location: TypeScript carets use display width and four-column tab stops', () => {
  const original = '  const 日本 = 1;\treturn 日本 +;';
  const shown = original.replace('\t', '   ');
  const stack = `${absoluteSource}:2\nfunction define() {\n${shown}\n${' '.repeat(33)}^\n}\n\nSyntaxError: bad`;
  const options = {...logical, readSource: (file: string) => file === absoluteSource ? `function define() {\n${original}\n}` : undefined};
  for (const code of ['ERR_INVALID_TYPESCRIPT_SYNTAX', 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX']) {
    assert.deepEqual(resolveErrorLocation({stack, code}, options), {loc: at(source, 2, original.lastIndexOf(';') + 1), via: []});
  }
});

test('source location: a V8 import caret is already a UTF-16 column', () => {
  const original = 'const s = "日本語";\timport {missing} from "./parts.ts";';
  const offset = original.indexOf('missing');
  const caret = original.slice(0, offset).replace(/[^\t]/g, ' ') + '^^^^^^^';
  const stack = `${pathToFileURL(absoluteSource).href}:2\n${original}\n${caret}\nSyntaxError: bad import`;
  assert.deepEqual(resolveErrorLocation({stack}, {...logical, readSource: () => `// first\n${original}`}), {loc: at(source, 2, offset + 1), via: []});
});

test('source location: a same-file helper keeps the throw and up to five callers in order', () => {
  const frames = Array.from({length: 8}, (_, i) => at(absoluteSource, i + 2, 3));
  const stack = `Error: oops\n    at define (${absoluteSource}:1:4)`;
  assert.deepEqual(resolveErrorLocation({stack, frames}, logical), {
    loc: at(source, 2, 3),
    via: frames.slice(1, 6).map(frame => ({...frame, file: source})),
  });
});

test('source location: another file is a fallback after the checked source has had priority', () => {
  const helper = at('/project/src/_parts.ts', 3, 14);
  const toolFrames = [
    at('/package/lib/dsl.ts', 100, 10), at('/package/check-diagram.ts', 101, 9), at('/package/drift-pool.js', 20, 5),
    at('/package/dist/drift-cache-io.js', 84, 22), at('/package/dist/lib/source-location-io.js', 10, 2), at('node:internal/esm', 2, 3),
  ];
  const frames = [...toolFrames, helper];
  assert.deepEqual(resolveErrorLocation({frames: [...frames, at(absoluteSource, 8, 4)]}, logical), {loc: at(source, 8, 4), via: []});
  assert.deepEqual(resolveErrorLocation({frames}, logical), {loc: at('src/_parts.ts', 3, 14), via: []});
  assert.deepEqual(resolveErrorLocation({frames: toolFrames}, logical), {via: []});
  for (const file of ['/package/examples/_parts.ts', '/package/test/_parts.ts']) {
    assert.deepEqual(resolveErrorLocation({frames: [...toolFrames, at(file, 1, 1)]}, logical), {loc: at(`..${file}`, 1, 1), via: []});
  }
});

test('source location: the checked source is kept even at the package root', () => {
  const source = 'figure.ts';
  const frames = [at('/package/figure.ts', 4, 9)];
  assert.deepEqual(resolveErrorLocation({frames}, {...logical, cwd: '/package', source}), {loc: at(source, 4, 9), via: []});
});

test('source location: text frames strip the fresh query and compare paths via realpath', () => {
  const actual = '/physical/日本 語/図.ts';
  const options = {...logical, source: './alias.ts', realpath: (file: string) => file === '/project/alias.ts' ? actual : file};
  const file = pathToFileURL(actual).href + '?svg-diagram-fresh=3';
  const stack = `Error: oops\n    at async define (${file}:5:7)\n    at async ${file}:9:2`;
  const frames = [at('node:internal/modules/esm', 1, 1)];
  assert.deepEqual(resolveErrorLocation({stack, frames}, options), {loc: at('./alias.ts', 5, 7), via: [at('./alias.ts', 9, 2)]});
});

test('source location: another file under a symlinked working directory is shown relative to the project', () => {
  const options = {...logical, realpath: (file: string) => file.replace(/^\/project\b/, '/physical')};
  assert.deepEqual(resolveErrorLocation({frames: [at('/physical/src/_parts.ts', 4, 3)]}, options),
    {loc: at('src/_parts.ts', 4, 3), via: []});
});

test('source location: a missing module is found at the matching relative import specifier', () => {
  const code = 'ERR_MODULE_NOT_FOUND';
  const first = "import {a} from './other.ts'; // from './nope.ts'";
  const second = "import {b} from './nested/../nope.ts';";
  const message = `Cannot find module '/project/src/日本 語/nope.ts' imported from ${absoluteSource}`;
  const options = {...logical, readSource: () => `${first}\n${second}`};
  assert.deepEqual(resolveErrorLocation({code, message}, options), {loc: at(source, 2, second.indexOf('./nested') + 1), via: []});
  assert.deepEqual(resolveErrorLocation({code, message: message.replace(absoluteSource, '/other.ts')}, options), {via: []});
});

test('source location: a missing package is found at its literal dynamic import', () => {
  const line = "export default () => import ('@missing/pkg');";
  const message = `Cannot find package '@missing/pkg' imported from ${absoluteSource}`;
  assert.deepEqual(resolveErrorLocation({code: 'ERR_MODULE_NOT_FOUND', message}, {...logical, readSource: () => line}),
    {loc: at(source, 1, line.indexOf('@missing/pkg') + 1), via: []});
});
