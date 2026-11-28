const test = require('node:test');
const assert = require('node:assert/strict');
const { rangeFromCells, extractRangeValues, clearRangeValues } = require('../src/sheet-range');

test('normalizes reverse-direction range selection into a rectangular range', () => {
  assert.deepEqual(rangeFromCells({ row: 4, col: 3 }, { row: 1, col: 1 }), {
    top: 1, left: 1, bottom: 4, right: 3, rowCount: 4, columnCount: 3, cellCount: 12
  });
});

test('extracts rectangular cell values including blank cells beyond used grid edges', () => {
  assert.deepEqual(extractRangeValues([['A', 'B'], ['C']], {
    top: 0, left: 0, bottom: 1, right: 2
  }), [['A', 'B', ''], ['C', '', '']]);
});

test('clears the selected rectangle without mutating the original worksheet', () => {
  const source = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];
  const result = clearRangeValues(source, { top: 0, left: 1, bottom: 1, right: 2 });
  assert.deepEqual(result, [['A', '', ''], ['D', '', ''], ['G', 'H', 'I']]);
  assert.deepEqual(source, [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']]);
});

test('rejects selection ranges beyond the supported cell limit', () => {
  assert.throws(() => rangeFromCells({ row: 0, col: 0 }, { row: 500, col: 500 }), /250,000-cell limit/i);
});

test('rejects invalid cell coordinates and incomplete ranges', () => {
  assert.throws(() => rangeFromCells({ row: -1, col: 0 }, { row: 0, col: 0 }), /valid cell/i);
  assert.throws(() => extractRangeValues([['A']], { top: 0, left: 0, bottom: 0, right: -1 }), /valid cell range/i);
});
