const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCellAddress,
  formatCellAddress,
  ensureCellExists,
  getKeyboardNavigationTarget
} = require('../src/sheet-navigation');

test('parses cell addresses case-insensitively and beyond column Z', () => {
  assert.deepEqual(parseCellAddress('a1'), { row: 0, col: 0 });
  assert.deepEqual(parseCellAddress('Z9'), { row: 8, col: 25 });
  assert.deepEqual(parseCellAddress('AA20'), { row: 19, col: 26 });
  assert.deepEqual(parseCellAddress('XFD1048576'), { row: 1048575, col: 16383 });
});

test('rejects malformed and out-of-range cell addresses', () => {
  for (const value of ['', 'A0', '0A', 'A-1', 'A1:B2', 'XFE1', 'A1048577', 'A 1', '$A$1']) {
    assert.throws(() => parseCellAddress(value), /cell reference/i, value);
  }
});

test('formats zero-based row and column coordinates as A1 references', () => {
  assert.equal(formatCellAddress(0, 0), 'A1');
  assert.equal(formatCellAddress(19, 26), 'AA20');
  assert.equal(formatCellAddress(1048575, 16383), 'XFD1048576');
});

test('ensures a target cell exists without changing existing values', () => {
  const cells = [['Revenue', '100'], ['Costs']];
  ensureCellExists(cells, 3, 2);
  assert.equal(cells[0][0], 'Revenue');
  assert.equal(cells[0][1], '100');
  assert.equal(cells[1][0], 'Costs');
  assert.equal(cells.length, 4);
  assert.equal(cells[3].length, 12);
});

test('expands the requested row and column for a Name Box target beyond the visible grid', () => {
  const cells = Array.from({ length: 20 }, () => Array(12).fill(''));
  ensureCellExists(cells, 29, 26);
  assert.equal(cells.length, 30);
  assert.equal(cells[0].length, 27);
  assert.equal(cells[29].length, 27);
});

test('rejects targets that would exceed the workbook cell safety limit', () => {
  const cells = [['keep']];
  assert.throws(() => ensureCellExists(cells, 250000, 0), /250,000-cell limit/i);
  assert.deepEqual(cells, [['keep']]);
});

test('handles large existing grids without overflowing a spread operation', () => {
  const cells = Array.from({ length: 250001 }, () => ['x']);
  assert.throws(() => ensureCellExists(cells, 0, 0), /250,000-cell limit/i);
  assert.equal(cells.length, 250001);
  assert.equal(cells[0].length, 1);
});

test('rejects invalid grid structures before expanding them', () => {
  assert.throws(() => ensureCellExists(null, 1, 1), /valid cell grid/i);
  assert.throws(() => ensureCellExists([['x'], null], 1, 1), /valid cell grid/i);
});

test('maps Enter and Shift+Enter to vertical cell movement', () => {
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'Enter' }), { row: 5, col: 2 });
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'Enter', shiftKey: true }), { row: 3, col: 2 });
});

test('maps Tab and Shift+Tab to horizontal cell movement', () => {
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'Tab' }), { row: 4, col: 3 });
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'Tab', shiftKey: true }), { row: 4, col: 1 });
});

test('maps arrow keys to adjacent cells without moving the caret mid-text', () => {
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowUp' }), { row: 3, col: 2 });
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowDown' }), { row: 5, col: 2 });
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowLeft', value: 'value', selectionStart: 0, selectionEnd: 0 }), { row: 4, col: 1 });
  assert.deepEqual(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowRight', value: 'value', selectionStart: 5, selectionEnd: 5 }), { row: 4, col: 3 });
  assert.equal(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowLeft', value: 'value', selectionStart: 2, selectionEnd: 2 }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowRight', value: 'value', selectionStart: 2, selectionEnd: 2 }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 4, col: 2, key: 'ArrowLeft', value: 'value', selectionStart: 0, selectionEnd: 2 }), null);
});

test('keeps keyboard navigation inside the supported spreadsheet boundaries', () => {
  assert.equal(getKeyboardNavigationTarget({ row: 0, col: 0, key: 'ArrowUp' }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 0, col: 0, key: 'ArrowLeft', value: '', selectionStart: 0, selectionEnd: 0 }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 0, col: 0, key: 'Tab', shiftKey: true }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 1048575, col: 16383, key: 'Enter' }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 1048575, col: 16383, key: 'Tab' }), null);
  assert.equal(getKeyboardNavigationTarget({ row: 3, col: 3, key: 'Escape' }), null);
});


test('maps spreadsheet worksheet shortcuts for previous, next and new sheet actions', () => {
  const { getWorksheetShortcutAction } = require('../src/sheet-navigation');
  assert.equal(getWorksheetShortcutAction({ key: 'PageUp', ctrlKey: true }), 'previous-sheet');
  assert.equal(getWorksheetShortcutAction({ key: 'PageDown', ctrlKey: true }), 'next-sheet');
  assert.equal(getWorksheetShortcutAction({ key: 'PageUp', metaKey: true }), 'previous-sheet');
  assert.equal(getWorksheetShortcutAction({ key: 'PageDown', metaKey: true }), 'next-sheet');
  assert.equal(getWorksheetShortcutAction({ key: 'F11', shiftKey: true }), 'add-sheet');
});

test('does not claim worksheet shortcuts without the required modifier', () => {
  const { getWorksheetShortcutAction } = require('../src/sheet-navigation');
  assert.equal(getWorksheetShortcutAction({ key: 'PageUp' }), null);
  assert.equal(getWorksheetShortcutAction({ key: 'PageDown', shiftKey: true }), null);
  assert.equal(getWorksheetShortcutAction({ key: 'F11' }), null);
  assert.equal(getWorksheetShortcutAction({ key: 'F2', ctrlKey: true }), null);
});

test('adds a row without exceeding the worksheet cell budget', () => {
  const { appendSheetRow } = require('../src/sheet-navigation');
  const source = [['A', 'B'], ['C', 'D']];
  const result = appendSheetRow(source);
  assert.deepEqual(result, [['A', 'B'], ['C', 'D'], ['', '']]);
  assert.deepEqual(source, [['A', 'B'], ['C', 'D']]);
});

test('adds a column while normalizing ragged rows and keeping values', () => {
  const { appendSheetColumn } = require('../src/sheet-navigation');
  const source = [['A', 'B'], ['C']];
  const result = appendSheetColumn(source);
  assert.deepEqual(result, [['A', 'B', ''], ['C', '', '']]);
  assert.deepEqual(source, [['A', 'B'], ['C']]);
});

test('rejects row or column additions that would exceed the 250,000-cell limit', () => {
  const { appendSheetRow, appendSheetColumn } = require('../src/sheet-navigation');
  const wide = Array.from({ length: 250 }, () => Array(1000).fill(''));
  assert.throws(() => appendSheetRow(wide), /250,000-cell limit/i);
  const tall = Array.from({ length: 250 }, () => Array(1000).fill(''));
  assert.throws(() => appendSheetColumn(tall), /250,000-cell limit/i);
});

test('rejects additions beyond the Excel worksheet dimension limits', () => {
  const { appendSheetRow, appendSheetColumn } = require('../src/sheet-navigation');
  const manyColumns = Array.from({ length: 1 }, () => Array(16384).fill(''));
  assert.throws(() => appendSheetColumn(manyColumns), /column limit/i);
});
