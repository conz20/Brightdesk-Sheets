const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, capture, undo, redo, canUndo, canRedo } = require('../src/sheet-history');
const { createWorkbookTable, updateWorkbookTableHeader } = require('../src/sheet-tables');

test('undo restores the previous workbook snapshot without sharing mutable data', () => {
  const history = createHistory();
  const workbook = { cells: [['before']] };
  capture(history, workbook);
  workbook.cells[0][0] = 'after';

  const restored = undo(history, workbook);
  assert.deepEqual(restored, { cells: [['before']] });
  restored.cells[0][0] = 'changed';
  assert.equal(workbook.cells[0][0], 'after');
});

test('redo reapplies the change after undo', () => {
  const history = createHistory();
  const before = { cells: [['before']] };
  const after = { cells: [['after']] };
  capture(history, before);
  const undone = undo(history, after);
  assert.deepEqual(undone, before);
  const redone = redo(history, undone);
  assert.deepEqual(redone, after);
});

test('a new edit after undo clears the redo history', () => {
  const history = createHistory();
  const first = { value: 1 };
  capture(history, first);
  const second = { value: 2 };
  const restored = undo(history, second);
  capture(history, { value: 3 });
  assert.equal(canRedo(history), false);
  assert.deepEqual(redo(history, restored), restored);
});

test('history is bounded to the configured number of snapshots', () => {
  const history = createHistory({ limit: 2 });
  capture(history, { value: 1 });
  capture(history, { value: 2 });
  capture(history, { value: 3 });
  assert.deepEqual(undo(history, { value: 4 }), { value: 3 });
  assert.deepEqual(undo(history, { value: 3 }), { value: 2 });
  assert.equal(undo(history, { value: 2 }), null);
});

test('history trims old snapshots to stay within its memory budget', () => {
  const history = createHistory({ limit: 10, maxBytes: 100 });
  capture(history, { value: 'a'.repeat(10) });
  capture(history, { value: 'b'.repeat(10) });
  capture(history, { value: 'c'.repeat(10) });
  assert.deepEqual(undo(history, { value: 'd'.repeat(10) }), { value: 'c'.repeat(10) });
  assert.deepEqual(undo(history, { value: 'c'.repeat(10) }), { value: 'b'.repeat(10) });
  assert.equal(undo(history, { value: 'b'.repeat(10) }), null);
});

test('oversized snapshots are rejected instead of exhausting memory', () => {
  const history = createHistory({ maxBytes: 100 });
  assert.equal(capture(history, { value: 'x'.repeat(200) }), false);
  assert.equal(canUndo(history), false);
});

test('empty undo and redo return null and expose their availability', () => {
  const history = createHistory();
  assert.equal(undo(history, { value: 1 }), null);
  assert.equal(redo(history, { value: 1 }), null);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
});


test('undo and redo restore edited table column names together with header cells', () => {
  const workbook = {
    activeWorksheetId: 'sales',
    cells: [['Product', 'Amount'], ['Pen', 10]],
    styles: {},
    tables: [],
    worksheets: [{
      id: 'sales',
      name: 'Sales',
      cells: [['Product', 'Amount'], ['Pen', 10]],
      styles: {},
      tables: []
    }]
  };
  createWorkbookTable(workbook, { top: 0, left: 0, bottom: 1, right: 1 }, 'SalesTable');

  const history = createHistory();
  capture(history, workbook);
  updateWorkbookTableHeader(workbook, 0, 1, 'Revenue');
  assert.deepEqual(workbook.cells[0], ['Product', 'Revenue']);
  assert.deepEqual(workbook.tables[0].columns, ['Product', 'Revenue']);

  const restored = undo(history, workbook);
  assert.deepEqual(restored.cells[0], ['Product', 'Amount']);
  assert.deepEqual(restored.tables[0].columns, ['Product', 'Amount']);
  assert.deepEqual(restored.worksheets[0].tables[0].columns, ['Product', 'Amount']);

  const reapplied = redo(history, restored);
  assert.deepEqual(reapplied.cells[0], ['Product', 'Revenue']);
  assert.deepEqual(reapplied.tables[0].columns, ['Product', 'Revenue']);
  assert.deepEqual(reapplied.worksheets[0].tables[0].columns, ['Product', 'Revenue']);
});


test('undo and redo restore worksheet renames together with every updated formula reference', () => {
  const { normalizeWorkbook, renameWorksheet } = require('../src/workbook-model');
  const { calculateCell } = require('../src/formula');
  const workbook = normalizeWorkbook({
    activeWorksheetId: 'summary',
    worksheets: [
      { id: 'revenue', name: 'Revenue', cells: [['10', '20']] },
      { id: 'summary', name: 'Summary', cells: [[
        '=Revenue!A1+Revenue!B1',
        '=SUM(Revenue!A1:B1)'
      ]] }
    ]
  });
  const history = createHistory();

  capture(history, workbook);
  renameWorksheet(workbook, 'revenue', 'Q4 Revenue');
  assert.equal(workbook.worksheets[0].name, 'Q4 Revenue');
  assert.equal(workbook.worksheets[1].cells[0][0], "='Q4 Revenue'!A1+'Q4 Revenue'!B1");

  const undone = undo(history, workbook);
  assert.equal(undone.worksheets[0].name, 'Revenue');
  assert.equal(undone.worksheets[1].cells[0][0], '=Revenue!A1+Revenue!B1');

  const restored = normalizeWorkbook(undone);
  const context = { worksheets: restored.worksheets, activeWorksheetId: 'summary' };
  assert.equal(calculateCell(restored.cells, 0, 0, new Set(), context), 30);
  assert.equal(calculateCell(restored.cells, 0, 1, new Set(), context), 30);

  const redone = redo(history, undone);
  assert.equal(redone.worksheets[0].name, 'Q4 Revenue');
  assert.equal(redone.worksheets[1].cells[0][0], "='Q4 Revenue'!A1+'Q4 Revenue'!B1");

  const reapplied = normalizeWorkbook(redone);
  const redoContext = { worksheets: reapplied.worksheets, activeWorksheetId: 'summary' };
  assert.equal(calculateCell(reapplied.cells, 0, 0, new Set(), redoContext), 30);
  assert.equal(calculateCell(reapplied.cells, 0, 1, new Set(), redoContext), 30);
});
