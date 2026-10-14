// node --test test/   — term spelling variants, glossary terms and table sums.
import test from 'node:test';
import assert from 'node:assert/strict';
import {termVariants, termFindings, tableFindings, parseNum, textsOf} from '../lib/consistency.ts';
import {box, table} from '../lib/dsl.ts';

test('parseNum: units, commas, signs; not a number', () => {
  assert.deepEqual(parseNum('1,200円'), {value: 1200, decimals: 0, unit: '円'});
  assert.deepEqual(parseNum('12.5%'), {value: 12.5, decimals: 1, unit: '%'});
  assert.equal(parseNum('ー'), null);
  assert.equal(parseNum('約 100'), null);
});

test('termVariants: a trailing long vowel mark or a letter-case class differs; Title vs lower does not', () => {
  assert.deepEqual(termVariants(['ユーザ管理', 'ユーザーを登録']), [['ユーザ', 'ユーザー']]);
  assert.deepEqual(termVariants(['API gateway', 'Api key']), [['API', 'Api']]);
  assert.deepEqual(termVariants(['Server', 'the server']), []);
  assert.deepEqual(termVariants(['サーバー', 'サーバー']), []);
});

test('textsOf reads labels and table cells, not ids', () => {
  const t = textsOf([box({id: 'secret-id', title: 'A', body: 'b'}), table([{label: '項目'}], [['x'], [{text: 'y'}]])]);
  assert.deepEqual(t.sort(), ['A', 'b', 'x', 'y', '項目'].sort());
});

test('termFindings: glossary terms to avoid, and variants the glossary already settles are not reported twice', () => {
  const bands = [box({title: '利用者の登録'}), box({title: 'ユーザの削除'}), box({title: 'ユーザーの変更'})];
  const f = termFindings(bands, {'ユーザー': ['利用者', 'ユーザ']});
  assert.equal(f.filter(x => x.rule === 'term-avoid').length, 1);
  assert.ok(f.find(x => x.rule === 'term-avoid')!.message.includes('利用者'));
  assert.ok(!f.some(x => x.rule === 'term-variant'));
  assert.equal(termFindings(bands, undefined).filter(x => x.rule === 'term-variant').length, 1);
});

test('tableFindings: a total row / column that does not add up; rounding of percentages is allowed', () => {
  const cols = [{label: '部門'}, {label: '4月'}, {label: '5月'}, {label: '合計'}];
  const ok = table(cols, [['営業', '10', '20', '30'], ['開発', '5', '5', '10'], ['合計', '15', '25', '40']]);
  assert.deepEqual(tableFindings([ok]), []);
  const bad = table(cols, [['営業', '10', '20', '31'], ['開発', '5', '5', '10'], ['合計', '15', '26', '40']]);
  const f = tableFindings([bad]);
  assert.equal(f.length, 3, '31 in a row, 26 in the total row, and the 合計 column of the total row (31 + 10 is not 40)');
  assert.ok(f.every(x => x.rule === 'table-sum-mismatch'));
  const share = table([{label: '区分'}, {label: '構成比'}], [['A', '33.3%'], ['B', '33.3%'], ['C', '33.4%']]);
  assert.deepEqual(tableFindings([share]), []);
  const round = table([{label: '区分'}, {label: '構成比'}], [['A', '33%'], ['B', '33%'], ['C', '33%']]);
  assert.deepEqual(tableFindings([round]), [], '99% is within rounding of three whole-number shares');
  const off = table([{label: '区分'}, {label: '構成比'}], [['A', '50%'], ['B', '30%']]);
  assert.equal(tableFindings([off])[0].rule, 'table-share-not-100');
  const withSub = table(cols.slice(0, 2), [['A', '10'], ['B', '5'], ['小計', '15'], ['C', '7'], ['合計', '22']]);
  assert.deepEqual(tableFindings([withSub]), []);
});
