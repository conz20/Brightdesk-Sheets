const test = require('node:test');
const assert = require('node:assert/strict');
const { fillRangeDown, fillRangeRight, translateFormulaReferences } = require('../src/sheet-fill');

test('fill down repeats the first selected row through the selected block', () => {
  const source = [['Name', 'Amount'], ['Old', '1'], ['Older', '2']];
  const result = fillRangeDown(source, { top: 0, left: 0, bottom: 2, right: 1 });
  assert.deepEqual(result, [['Name', 'Amount'], ['Name', 'Amount'], ['Name', 'Amount']]);
  assert.deepEqual(source, [['Name', 'Amount'], ['Old', '1'], ['Older', '2']]);
});

test('fill right repeats the first selected column through the selected block', () => {
  const source = [['Label', 'Old', 'Older'], ['Total', '1', '2']];
  assert.deepEqual(fillRangeRight(source, { top: 0, left: 0, bottom: 1, right: 2 }), [
    ['Label', 'Label', 'Label'],
    ['Total', 'Total', 'Total']
  ]);
});

test('fill down adjusts relative local cell and range references', () => {
  const source = [['=A1+SUM(A1:A3)'], [''], ['']];
  assert.deepEqual(fillRangeDown(source, { top: 0, left: 0, bottom: 2, right: 0 }), [
    ['=A1+SUM(A1:A3)'],
    ['=A2+SUM(A2:A4)'],
    ['=A3+SUM(A3:A5)']
  ]);
});

test('fill right adjusts relative columns and preserves quoted worksheet names', () => {
  const source = [["='Quarter 1'!A1+Revenue!B2", '', '']];
  assert.deepEqual(fillRangeRight(source, { top: 0, left: 0, bottom: 0, right: 2 }), [[
    "='Quarter 1'!A1+Revenue!B2",
    "='Quarter 1'!B1+Revenue!C2",
    "='Quarter 1'!C1+Revenue!D2"
  ]]);
});

test('does not modify non-formula text while filling', () => {
  assert.equal(translateFormulaReferences('Quarter 1', 1, 1), 'Quarter 1');
  assert.equal(translateFormulaReferences('=1+2', 1, 1), '=1+2');
});

test('single-row fill down and single-column fill right leave values unchanged', () => {
  assert.deepEqual(fillRangeDown([['A', 'B']], { top: 0, left: 0, bottom: 0, right: 1 }), [['A', 'B']]);
  assert.deepEqual(fillRangeRight([['A'], ['B']], { top: 0, left: 0, bottom: 1, right: 0 }), [['A'], ['B']]);
});

test('rejects fills that exceed the worksheet cell limit', () => {
  const wide = Array.from({ length: 500 }, () => Array(500).fill('x'));
  assert.throws(() => fillRangeDown(wide, { top: 0, left: 0, bottom: 500, right: 499 }), /250,000-cell limit/i);
});

test('rejects formula references shifted beyond spreadsheet boundaries', () => {
  assert.throws(() => translateFormulaReferences('=A1', -1, 0), /outside the supported spreadsheet range/i);
  assert.throws(() => translateFormulaReferences('=XFD1', 0, 1), /outside the supported spreadsheet range/i);
});


test('fill down and fill right preserve scientific-notation constants', () => {
  const down = fillRangeDown([['=1E3+A1'], [''], ['']], {
    top: 0, left: 0, bottom: 2, right: 0
  });
  assert.deepEqual(down, [['=1E3+A1'], ['=1E3+A2'], ['=1E3+A3']]);

  const right = fillRangeRight([['=1E3+A1', '', '']], {
    top: 0, left: 0, bottom: 0, right: 2
  });
  assert.deepEqual(right, [['=1E3+A1', '=1E3+B1', '=1E3+C1']]);
});
