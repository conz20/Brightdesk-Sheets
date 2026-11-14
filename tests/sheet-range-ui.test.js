const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Name Box navigation clears any previous multi-cell selection before rendering the target', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function jumpToSheetCell(reference)');
  const end = app.indexOf('\nconst ribbonTabs', start);
  assert.ok(start >= 0 && end > start, 'jumpToSheetCell must exist');
  const body = app.slice(start, end);
  const reset = body.indexOf('resetSheetSelection(target.row, target.col)');
  const render = body.indexOf('renderSheet()');
  assert.ok(reset >= 0 && render > reset, 'selection reset must happen before the target grid is rendered');
});

test('Shift-click retains the original selection anchor and highlights the rectangular range', () => {
  const app = read('src/app.js');
  assert.match(app, /event\.shiftKey && state\.selectionAnchor/);
  assert.match(app, /sheetRange\.rangeFromCells\(state\.selectionAnchor, focus\)/);
  assert.match(app, /applySheetRangeHighlight\(\)/);
});

test('cell formatting commands apply to the entire selected range', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function applySelectedCellStyle(changes)');
  const end = app.indexOf('\nfunction currentSheetRange()', start);
  assert.ok(start >= 0 && end > start, 'range formatting handler must exist');
  const body = app.slice(start, end);
  assert.match(body, /currentSheetRange\(\)/);
  assert.match(body, /updateCellStylesInRange/);
});

test('Home ribbon exposes Fill Down and Fill Right actions', () => {
  const app = read('src/app.js');
  assert.match(app, /addButton\(fill, 'Fill Down', fillSelectedRangeDown/);
  assert.match(app, /addButton\(fill, 'Fill Right', fillSelectedRangeRight/);
});

test('Fill helpers load before the Sheets renderer', () => {
  const html = read('src/index.html');
  const fill = html.indexOf('src="sheet-fill.js"');
  const renderer = html.indexOf('src="app.js"');
  assert.ok(fill >= 0 && renderer > fill, 'sheet-fill.js must load before app.js');
});
