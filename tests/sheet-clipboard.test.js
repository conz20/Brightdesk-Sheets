const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseClipboardGrid,
  serializeClipboardGrid,
  pasteClipboardGrid
} = require('../src/sheet-clipboard');

test('parses tab-separated clipboard blocks into rows and columns', () => {
  assert.deepEqual(parseClipboardGrid('Name\tAmount\r\nSales\t100\r\nCosts\t25'), [
    ['Name', 'Amount'],
    ['Sales', '100'],
    ['Costs', '25']
  ]);
});

test('preserves quoted tabs, quotes and line breaks inside clipboard cells', () => {
  assert.deepEqual(parseClipboardGrid('"first\tcell"\t"say ""hello"""\r\n"two\nlines"\tend'), [
    ['first\tcell', 'say "hello"'],
    ['two\nlines', 'end']
  ]);
});

test('does not add an extra row for a trailing clipboard line break', () => {
  assert.deepEqual(parseClipboardGrid('A\tB\r\n1\t2\r\n'), [['A', 'B'], ['1', '2']]);
});

test('rejects malformed clipboard quoting and excessive clipboard cell counts', () => {
  assert.throws(() => parseClipboardGrid('"unfinished'), /invalid quotation/i);
  assert.throws(() => parseClipboardGrid('"closed"x\tvalue'), /invalid quotation/i);
  assert.throws(() => parseClipboardGrid(Array(250001).fill('x').join('\t')), /250,000-cell limit/i);
});

test('serializes cell blocks safely for pasting into other spreadsheet programs', () => {
  assert.equal(serializeClipboardGrid([['plain', 'two\tcolumns'], ['say "hi"', 'two\nlines']]),
    'plain\t"two\tcolumns"\r\n"say ""hi"""\t"two\nlines"');
});

test('pastes a rectangular clipboard block into the selected cell without mutating the source grid', () => {
  const source = [['A', 'B'], ['C', 'D']];
  const result = pasteClipboardGrid(source, 1, 1, [['x', 'y'], ['z', 'w']]);
  assert.deepEqual(result, [['A', 'B', ''], ['C', 'x', 'y'], ['', 'z', 'w']]);
  assert.deepEqual(source, [['A', 'B'], ['C', 'D']]);
});

test('rejects clipboard pastes that exceed the 250,000-cell worksheet limit', () => {
  const source = Array.from({ length: 500 }, () => Array(500).fill(''));
  assert.throws(() => pasteClipboardGrid(source, 0, 0, [['x']]), /250,000-cell limit/i);
  assert.throws(() => pasteClipboardGrid([['a']], 0, 0, Array.from({ length: 501 }, () => Array(500).fill('x'))), /250,000-cell limit/i);
});

test('rejects invalid destinations and malformed grids', () => {
  assert.throws(() => pasteClipboardGrid([['a']], -1, 0, [['x']]), /valid cell/i);
  assert.throws(() => pasteClipboardGrid([['a']], 0, 0, [['x'], 'bad']), /valid clipboard grid/i);
});
