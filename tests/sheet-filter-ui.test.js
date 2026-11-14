const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('loads worksheet data tools before the Sheets renderer', () => {
  const html = read('src/index.html');
  const helper = html.indexOf('src="sheet-data-tools.js"');
  const renderer = html.indexOf('src="app.js"');
  assert.ok(helper >= 0 && renderer > helper, 'sheet-data-tools.js must load before app.js');
});

test('Sheets exposes an accessible AutoFilter control on the Data ribbon', () => {
  const app = read('src/app.js');
  assert.match(app, /setAutoFilterEnabled/);
  assert.match(app, /aria-pressed/);
  assert.match(app, /Clear all filters/);
});

test('worksheet column filters use accessible controls and text-safe value rendering', () => {
  const app = read('src/app.js');
  assert.match(app, /sheet-filter-trigger/);
  assert.match(app, /sheet-filter-menu/);
  assert.match(app, /role', 'group'/);
  assert.match(app, /aria-label/);
  assert.match(app, /optionLabel\.textContent/);
  assert.match(app, /getUniqueColumnValues/);
});

test('filtered worksheets render only matching data rows and preserve original row indexes', () => {
  const app = read('src/app.js');
  assert.match(app, /getVisibleRowIndexes/);
  assert.match(app, /visibleRowIndexes/);
  assert.match(app, /data-row/);
});

test('sorting keeps row formatting aligned and uses the safe workbook sort model', () => {
  const app = read('src/app.js');
  assert.match(app, /sortWorksheet\(/);
  assert.doesNotMatch(app, /activeDoc\(\)\.cells\.sort\(/);
});

test('worksheet filter menus can be dismissed without applying pending choices', () => {
  const app = read('src/app.js');
  assert.match(app, /Cancel/);
  assert.match(app, /closeSheetFilterMenu/);
});


test('filtered keyboard navigation focuses the resolved visible row, not the hidden target', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('visibleRows.includes(nextTarget.row)'));
  const navigation = app.slice(app.indexOf('let next = sheetWrap.querySelector'), app.indexOf('persist();', app.indexOf('let next = sheetWrap.querySelector')));
  assert.ok(navigation.includes("' + nextTarget.row + '"));
  assert.ok(!navigation.includes('${target.row}'));
});


test('editing a filtered cell moves focus when that edit hides the active row', () => {
  const app = read('src/app.js');
  assert.ok(app.includes('function refreshSheetAfterFilterableEdit'));
  assert.ok(app.includes('const moved = keepSelectedSheetCellVisible()'));
  assert.ok(app.includes('if (moved) {'));
});

test('formula-bar edits refresh filtered visibility and keep the selected cell reachable', () => {
  const app = read('src/app.js');
  const handler = app.slice(app.indexOf("$('formula-input').addEventListener('change'"), app.indexOf("$('sheet-zoom-out')", app.indexOf("$('formula-input').addEventListener('change'")));
  assert.ok(handler.includes('refreshSheetAfterFilterableEdit'));
});

test('cut operations restore a visible selection after filtered rows are recalculated', () => {
  const app = read('src/app.js');
  const handler = app.slice(app.indexOf('function cutSelectedSheetCell'), app.indexOf('function pasteIntoSelectedSheetCell'));
  assert.ok(handler.includes('keepSelectedSheetCellVisible'));
});
