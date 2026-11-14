const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmptyGrid,
  normalizeWorkbook,
  syncActiveWorksheet,
  activateWorksheet,
  addWorksheet,
  renameWorksheet,
  deleteWorksheet,
  moveWorksheet
} = require('../src/workbook-model');

test('migrates a legacy single-sheet workbook without losing cell values or title', () => {
  const legacy = { title: 'Forecast', cells: [['Revenue', '42'], ['=SUM(B1:B1)', '']] };
  const workbook = normalizeWorkbook(legacy);
  assert.equal(workbook.title, 'Forecast');
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.worksheets[0].name, 'Sheet1');
  assert.deepEqual(workbook.cells, legacy.cells);
  assert.equal(workbook.activeWorksheetId, workbook.worksheets[0].id);
});

test('keeps saved worksheets and restores the saved active worksheet', () => {
  const workbook = normalizeWorkbook({
    activeWorksheetId: 'expenses',
    worksheets: [
      { id: 'sales', name: 'Sales', cells: [['100']] },
      { id: 'expenses', name: 'Expenses', cells: [['25']] }
    ]
  });
  assert.equal(workbook.activeWorksheetId, 'expenses');
  assert.deepEqual(workbook.cells, [['25']]);
});

test('switching sheets saves the previous sheet and loads the selected sheet', () => {
  const workbook = normalizeWorkbook({ cells: [['first']] });
  workbook.cells[0][0] = 'changed';
  addWorksheet(workbook, 'Summary');
  workbook.cells[0][0] = 'total';
  activateWorksheet(workbook, 'sheet-1');
  assert.deepEqual(workbook.cells, [['changed']]);
  assert.equal(workbook.worksheets[1].cells[0][0], 'total');
});

test('adds uniquely named independent worksheets with a starter grid', () => {
  const workbook = normalizeWorkbook({ cells: [['keep']] });
  addWorksheet(workbook, 'Sheet1');
  assert.equal(workbook.worksheets.length, 2);
  assert.equal(workbook.worksheets[1].name, 'Sheet1 (2)');
  assert.notDeepEqual(workbook.cells, workbook.worksheets[0].cells);
  assert.deepEqual(workbook.cells, createEmptyGrid());
});

test('renames worksheets and rejects invalid or duplicate names', () => {
  const workbook = normalizeWorkbook({ cells: [['x']] });
  addWorksheet(workbook, 'Costs');
  assert.throws(() => renameWorksheet(workbook, 'sheet-1', 'costs'), /already exists/i);
  for (const invalid of ['bad/name', 'bad\\\\name', 'bad:name', 'bad?name', 'bad*name', 'bad[name', 'bad]name']) {
    assert.throws(() => renameWorksheet(workbook, 'sheet-1', invalid), /cannot contain/i);
  }
  assert.throws(() => renameWorksheet(workbook, 'sheet-1', 'x'.repeat(32)), /31 characters/i);
  renameWorksheet(workbook, 'sheet-1', 'Overview');
  assert.equal(workbook.worksheets[0].name, 'Overview');
});

test('deletes a worksheet without deleting the final remaining sheet', () => {
  const workbook = normalizeWorkbook({ cells: [['one']] });
  addWorksheet(workbook, 'Second');
  workbook.cells[0][0] = 'two';
  deleteWorksheet(workbook, 'sheet-2');
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.activeWorksheetId, 'sheet-1');
  assert.deepEqual(workbook.cells, [['one']]);
  assert.throws(() => deleteWorksheet(workbook, 'sheet-1'), /at least one worksheet/i);
});

test('reorders worksheets without changing the active worksheet or their data', () => {
  const workbook = normalizeWorkbook({ cells: [['a']] });
  addWorksheet(workbook, 'Second');
  workbook.cells[0][0] = 'b';
  addWorksheet(workbook, 'Third');
  moveWorksheet(workbook, 'sheet-3', 0);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Third', 'Sheet1', 'Second']);
  assert.equal(workbook.activeWorksheetId, 'sheet-3');
  assert.deepEqual(workbook.cells, createEmptyGrid());
});

test('synchronises the active sheet before the workbook is persisted', () => {
  const workbook = normalizeWorkbook({ cells: [['original']] });
  workbook.cells[0][0] = 'updated';
  syncActiveWorksheet(workbook);
  const restored = normalizeWorkbook(JSON.parse(JSON.stringify(workbook)));
  assert.deepEqual(restored.cells, [['updated']]);
  assert.deepEqual(restored.worksheets[0].cells, [['updated']]);
});
