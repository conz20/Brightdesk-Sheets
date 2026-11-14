const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAutoFilterState,
  normalizeAutoFilterState,
  getUniqueColumnValues,
  setColumnFilter,
  clearColumnFilter,
  clearAllColumnFilters,
  getVisibleRowIndexes,
  sortWorksheet
} = require('../src/sheet-data-tools');

test('creates a clean disabled AutoFilter state', () => {
  assert.deepEqual(createAutoFilterState(), { enabled: false, filters: {} });
});

test('normalizes saved filter criteria without retaining invalid column keys or values', () => {
  assert.deepEqual(normalizeAutoFilterState({
    enabled: true,
    filters: {
      '1': ['East', '', 'West', 'East'],
      '-1': ['ignored'],
      '2.5': ['ignored'],
      '3': ['North', 42, null]
    }
  }), {
    enabled: true,
    filters: {
      '1': ['East', '', 'West'],
      '3': ['North']
    }
  });
});

test('lists unique column values from the data area and includes blank cells', () => {
  const cells = [
    ['Region', 'Sales'],
    ['West', '10'],
    ['East', '20'],
    ['', '30'],
    ['West', '40'],
    ['East', '50']
  ];
  assert.deepEqual(getUniqueColumnValues(cells, 0), ['', 'East', 'West']);
});

test('stores selected filter values immutably and clears one or all column filters', () => {
  const original = { enabled: true, filters: { '0': ['East'] } };
  const withSecond = setColumnFilter(original, 1, ['Open', 'Closed', 'Open']);
  assert.deepEqual(original, { enabled: true, filters: { '0': ['East'] } });
  assert.deepEqual(withSecond, { enabled: true, filters: { '0': ['East'], '1': ['Open', 'Closed'] } });
  assert.deepEqual(clearColumnFilter(withSecond, 0), { enabled: true, filters: { '1': ['Open', 'Closed'] } });
  assert.deepEqual(clearAllColumnFilters(withSecond), { enabled: true, filters: {} });
});

test('filters worksheet rows by every active column criterion while retaining original row indexes', () => {
  const cells = [
    ['Region', 'Status', 'Amount'],
    ['East', 'Open', '100'],
    ['West', 'Open', '200'],
    ['East', 'Closed', '300'],
    ['West', 'Closed', '400'],
    ['', 'Open', '500']
  ];
  const state = setColumnFilter(
    setColumnFilter(createAutoFilterState(), 0, ['East', '']),
    1,
    ['Open']
  );
  assert.deepEqual(getVisibleRowIndexes(cells, state), [0, 1, 5]);
});

test('disabled filters and filters with no criteria leave every row visible', () => {
  const cells = [['Name'], ['A'], ['B']];
  assert.deepEqual(getVisibleRowIndexes(cells, createAutoFilterState()), [0, 1, 2]);
  assert.deepEqual(getVisibleRowIndexes(cells, { enabled: true, filters: {} }), [0, 1, 2]);
});

test('sorts data rows while keeping the header in place and blank values last in both directions', () => {
  const cells = [
    ['Name', 'Amount'],
    ['Beta', '20'],
    ['', '5'],
    ['Alpha', '30'],
    ['Gamma', '']
  ];
  const ascending = sortWorksheet(cells, {}, 0, { descending: false });
  assert.deepEqual(ascending.cells, [
    ['Name', 'Amount'],
    ['Alpha', '30'],
    ['Beta', '20'],
    ['Gamma', ''],
    ['', '5']
  ]);
  const descending = sortWorksheet(cells, {}, 1, { descending: true });
  assert.deepEqual(descending.cells, [
    ['Name', 'Amount'],
    ['Alpha', '30'],
    ['Beta', '20'],
    ['', '5'],
    ['Gamma', '']
  ]);
});

test('sort is stable for equal values and does not mutate the input grid', () => {
  const cells = [['Name'], ['Same'], ['Same'], ['Other']];
  const result = sortWorksheet(cells, {}, 0);
  assert.deepEqual(result.cells, [['Name'], ['Other'], ['Same'], ['Same']]);
  assert.deepEqual(cells, [['Name'], ['Same'], ['Same'], ['Other']]);
});

test('moves cell formatting with its entire row during sorting', () => {
  const cells = [['Name', 'Value'], ['B', '2'], ['A', '1']];
  const styles = {
    A2: { bold: true },
    B2: { numberFormat: 'currency' },
    A3: { italic: true },
    B3: { fill: '#EDF7F1' },
    A1: { underline: true }
  };
  const result = sortWorksheet(cells, styles, 0);
  assert.deepEqual(result.cells, [['Name', 'Value'], ['A', '1'], ['B', '2']]);
  assert.deepEqual(result.styles, {
    A1: { underline: true },
    A2: { italic: true },
    B2: { fill: '#EDF7F1' },
    A3: { bold: true },
    B3: { numberFormat: 'currency' }
  });
});

test('adjusts local formula references when a row moves but leaves other-sheet references intact', () => {
  const cells = [
    ['Name', 'Local total', 'Other total'],
    ['B', '=A2*2', "='Budget'!A2"],
    ['A', '=A3*2', "='Budget'!A3"]
  ];
  const result = sortWorksheet(cells, {}, 0, { worksheetName: 'Sales' });
  assert.deepEqual(result.cells, [
    ['Name', 'Local total', 'Other total'],
    ['A', '=A2*2', "='Budget'!A3"],
    ['B', '=A3*2', "='Budget'!A2"]
  ]);
});

test('rejects invalid sort columns and malformed worksheet grids without mutating them', () => {
  const cells = [['A'], ['B']];
  assert.throws(() => sortWorksheet(cells, {}, -1), /column/i);
  assert.throws(() => sortWorksheet([['A'], null], {}, 0), /valid worksheet grid/i);
  assert.deepEqual(cells, [['A'], ['B']]);
});
