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

test('the Data ribbon exposes create, rename and convert-to-range table actions', () => {
  const app = read('src/app.js');
  assert.ok(app.includes("'Format as Table'"));
  assert.ok(app.includes("'Rename Table'"));
  assert.ok(app.includes("'Convert to Range'"));
});

test('creating a structured table uses the selected range, worksheet metadata and Brightdesk style', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('sheetTables.createTable('));
  assert.ok(app.includes('currentSheetRange()'));
  assert.ok(app.includes('sheetTables.applyTableStyles'));
  assert.ok(app.includes('allOtherWorksheetTables(doc)'));
});

test('renaming a structured table checks workbook-wide table names', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('sheetTables.renameTable('));
  assert.ok(app.includes('allOtherWorksheetTables(doc)'));
});

test('converting a table to a range removes only table metadata and retains its cell grid and formatting', () => {
  const app = read('src/app.js');
  const handler = app.slice(app.indexOf('function convertStructuredTableToRange'), app.indexOf('function sortSheetColumn'));
  assert.ok(handler.includes('sheetTables.removeTable'));
  assert.ok(!handler.includes('doc.cells ='));
  assert.ok(!handler.includes('doc.styles ='));
});
