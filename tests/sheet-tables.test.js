const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTable,
  renameTable,
  removeTable,
  findTableAtCell,
  applyTableStyles
} = require('../src/sheet-tables');

test('creates a named table with unique cleaned header names inside a selected range', () => {
  const cells = [
    ['Product', 'Amount', 'amount', ''],
    ['Pens', '10', '12', 'outside'],
    ['Paper', '20', '22', 'outside']
  ];
  const result = createTable([], cells, { top: 0, left: 0, bottom: 2, right: 2 }, 'SalesTable');
  assert.equal(result.table.name, 'SalesTable');
  assert.deepEqual(result.table.columns, ['Product', 'Amount', 'amount 2']);
  assert.deepEqual(result.cells[0], ['Product', 'Amount', 'amount 2', '']);
  assert.deepEqual(result.cells[1], cells[1]);
  assert.equal(result.table.range.bottom, 2);
  assert.equal(result.table.style, 'brightdesk-green');
  assert.deepEqual(cells[0], ['Product', 'Amount', 'amount', '']);
});

test('generates safe default column headers for blank selected header cells', () => {
  const result = createTable([], [['', 'Name', ''], ['1', 'Alice', 'x']], {
    top: 0, left: 0, bottom: 1, right: 2
  }, 'People');
  assert.deepEqual(result.table.columns, ['Column1', 'Name', 'Column3']);
  assert.deepEqual(result.cells[0], ['Column1', 'Name', 'Column3']);
});

test('rejects invalid, duplicate or cell-like table names', () => {
  const cells = [['Name'], ['A']];
  assert.throws(() => createTable([], cells, { top: 0, left: 0, bottom: 1, right: 0 }, 'Bad Name'), /valid table name/i);
  assert.throws(() => createTable([], cells, { top: 0, left: 0, bottom: 1, right: 0 }, 'A1'), /valid table name/i);
  assert.throws(() => createTable([{ id: 't1', name: 'Sales', range: { top: 0, left: 0, bottom: 0, right: 0 }, columns: ['Name'] }], cells, {
    top: 0, left: 0, bottom: 1, right: 0
  }, 'sales'), /already exists/i);
});

test('rejects overlapping table ranges and out-of-grid selections', () => {
  const existing = [{ id: 'table-1', name: 'FirstTable', range: { top: 0, left: 0, bottom: 1, right: 1 }, columns: ['A', 'B'], style: 'brightdesk-green' }];
  assert.throws(() => createTable(existing, [['A', 'B'], ['1', '2']], {
    top: 1, left: 1, bottom: 1, right: 1
  }, 'SecondTable'), /overlap/i);
  assert.throws(() => createTable([], [['A']], { top: 0, left: 0, bottom: 2, right: 0 }, 'Outside'), /inside the worksheet/i);
});

test('rejects invalid or excessive table ranges', () => {
  assert.throws(() => createTable([], [['A']], { top: -1, left: 0, bottom: 0, right: 0 }, 'Invalid'), /valid table range/i);
  assert.throws(() => createTable([], Array.from({ length: 501 }, () => Array(500).fill('x')), {
    top: 0, left: 0, bottom: 500, right: 499
  }, 'HugeTable'), /250,000-cell limit/i);
});

test('renames a table without changing its range or columns and rejects duplicates', () => {
  const table = { id: 'table-1', name: 'SalesTable', range: { top: 0, left: 0, bottom: 1, right: 1 }, columns: ['Date', 'Amount'], style: 'brightdesk-green' };
  const result = renameTable([table], 'table-1', 'AnnualSales', []);
  assert.equal(result[0].name, 'AnnualSales');
  assert.deepEqual(result[0].range, table.range);
  assert.deepEqual(result[0].columns, table.columns);
  assert.throws(() => renameTable([table], 'table-1', 'Costs', [{ id: 'other', name: 'Costs' }]), /already exists/i);
});

test('removes table metadata and finds a table only when the cell is inside its range', () => {
  const tables = [{ id: 'table-1', name: 'SalesTable', range: { top: 1, left: 2, bottom: 4, right: 5 }, columns: ['A', 'B', 'C', 'D'], style: 'brightdesk-green' }];
  assert.equal(findTableAtCell(tables, 3, 4).name, 'SalesTable');
  assert.equal(findTableAtCell(tables, 4, 6), null);
  assert.deepEqual(removeTable(tables, 'table-1'), []);
});

test('applies Brightdesk green header and alternating body banding without changing unrelated styles', () => {
  const table = { range: { top: 0, left: 1, bottom: 2, right: 2 }, columns: ['Name', 'Value'] };
  const styles = applyTableStyles({ A1: { italic: true }, B1: { numberFormat: 'currency' } }, table);
  assert.deepEqual(styles.A1, { italic: true });
  assert.equal(styles.B1.bold, true);
  assert.equal(styles.B1.fill, '#27845C');
  assert.equal(styles.B1.color, '#FFFFFF');
  assert.equal(styles.C1.bold, true);
  assert.equal(styles.B2.fill, '#EDF7F1');
  assert.equal(styles.C2.fill, '#EDF7F1');
  assert.equal(styles.B3.fill, null);
});
