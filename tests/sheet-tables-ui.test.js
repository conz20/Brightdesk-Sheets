const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('loads the structured table helper before the Sheets application', () => {
  const html = read('src/index.html');
  const helper = html.indexOf('src="sheet-tables.js"');
  const app = html.indexOf('src="app.js"');
  assert.ok(helper >= 0 && app > helper);
});

test('the Insert ribbon exposes a Table command and the Data ribbon retains table management actions', () => {
  const app = read('src/app.js');
  const sheetsStart = app.indexOf("} else if (app === 'sheets') {");
  const slidesStart = app.indexOf("} else if (app === 'slides')", sheetsStart);
  assert.ok(sheetsStart >= 0 && slidesStart > sheetsStart);
  const sheets = app.slice(sheetsStart, slidesStart);

  const insertStart = sheets.indexOf("} else if (tab === 'insert') {");
  const formulasStart = sheets.indexOf("} else if (tab === 'formulas')", insertStart);
  assert.ok(insertStart >= 0 && formulasStart > insertStart);
  assert.match(sheets.slice(insertStart, formulasStart), /addButton\(insert, 'Table', createStructuredTable/);

  assert.ok(sheets.includes("'Format as Table'"));
  assert.ok(sheets.includes("'Rename Table'"));
  assert.ok(sheets.includes("'Convert to Range'"));
});

test('creating a structured table uses the selected range and workbook-level table persistence', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function createStructuredTable()');
  const end = app.indexOf('function renameStructuredTable()', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('currentSheetRange()'));
  assert.ok(handler.includes('recordSheetHistory()'));
  assert.ok(handler.includes('sheetTables.createWorkbookTable('));
  assert.ok(handler.includes('persist()'));
  assert.ok(handler.includes('renderSheet()'));
});

test('renaming a structured table checks workbook-wide names and syncs active worksheet state', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function renameStructuredTable()');
  const end = app.indexOf('function convertStructuredTableToRange()', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('sheetTables.renameWorkbookTable('));
  assert.ok(handler.includes('recordSheetHistory()'));
  assert.ok(handler.includes('persist()'));
});

test('converting a structured table to a range removes metadata but retains cell values and formatting', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function convertStructuredTableToRange()');
  const end = app.indexOf('function sortSheetColumn', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('sheetTables.removeWorkbookTable('));
  assert.ok(handler.includes('recordSheetHistory()'));
  assert.ok(handler.includes('persist()'));
  assert.ok(!handler.includes('doc.cells ='));
  assert.ok(!handler.includes('doc.styles ='));
});


test('editing a table header updates the table column definition before saving', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function setCell(');
  const end = app.indexOf('function renameWorksheetFromPrompt', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes("state.app === 'sheets'"));
  assert.ok(handler.includes('sheetTables.updateWorkbookTableHeader('));
  assert.ok(handler.includes('recordSheetHistory()'));
  assert.ok(handler.includes('persist()'));
});


test('saving worksheet edits reconciles structured table headers before local persistence', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function persist()');
  const end = app.indexOf('function loadLocal()', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('sheetTables.synchronizeWorkbookTableHeaders(state.docs.sheets)'));
  assert.ok(handler.indexOf('sheetTables.synchronizeWorkbookTableHeaders(') < handler.indexOf('workbookModel.syncActiveWorksheet('));
});


test('renaming a worksheet refreshes the grid and toolbar after updating formula references', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function renameWorksheetFromPrompt(');
  const end = app.indexOf('function deleteWorksheetWithConfirmation(', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('recordSheetHistory()'));
  assert.ok(handler.includes('workbookModel.renameWorksheet('));
  assert.ok(handler.includes('renderSheetTabs()'));
  assert.ok(handler.includes('renderSheet()'));
  assert.ok(handler.includes('renderToolbar()'));
  assert.ok(handler.includes('persist()'));
});


test('sorting remaps references in other worksheets to the moved source rows', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function sortSheetColumn(');
  const end = app.indexOf('function applyPageLayout(', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.ok(handler.includes('sorted.destinationBySourceRow'));
  assert.ok(handler.includes('translateExternalFormulaRow('));
  assert.ok(handler.includes('otherWorksheet.cells'));
  assert.ok(handler.includes('workbookModel.syncActiveWorksheet') || handler.includes('persist()'));
});
