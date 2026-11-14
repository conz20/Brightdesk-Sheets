const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateCell, arithmetic, columnIndex } = require('../src/formula');

test('column labels convert beyond Z', () => {
  assert.equal(columnIndex('A'), 0);
  assert.equal(columnIndex('Z'), 25);
  assert.equal(columnIndex('AA'), 26);
});

test('arithmetic parser handles precedence and parentheses', () => {
  assert.equal(arithmetic('2 + 3 * 4'), 14);
  assert.equal(arithmetic('(2 + 3) * 4'), 20);
  assert.equal(arithmetic('18 / 3 - 2'), 4);
});

test('grid calculates basic arithmetic and range functions', () => {
  const cells = [['10','20','=A1+B1'], ['5','7','=SUM(A1:B2)'], ['', '', '=AVERAGE(A1:B2)']];
  assert.equal(calculateCell(cells, 0, 2), 30);
  assert.equal(calculateCell(cells, 1, 2), 42);
  assert.equal(calculateCell(cells, 2, 2), 10.5);
});

test('formula cycle is reported instead of recursing forever', () => {
  const cells = [['=B1','=A1']];
  assert.equal(calculateCell(cells, 0, 0), '#VALUE!');
});

test('COUNT and AVERAGE ignore blank cells in ranges', () => {
  const cells = [['10'], [''], ['20'], ['=COUNT(A1:A3)'], ['=AVERAGE(A1:A3)']];
  assert.equal(calculateCell(cells, 3, 0), 2);
  assert.equal(calculateCell(cells, 4, 0), 15);
});


test('resolves direct references to another worksheet', () => {
  const worksheets = [
    { id: 'revenue', name: 'Revenue', cells: [['18']] },
    { id: 'forecast', name: 'Forecast', cells: [['=Revenue!A1*2']] }
  ];
  assert.equal(calculateCell(worksheets[1].cells, 0, 0, new Set(), {
    worksheets,
    activeWorksheetId: 'forecast'
  }), 36);
});

test('resolves quoted worksheet names including apostrophes', () => {
  const worksheets = [
    { id: 'quarter', name: 'Quarter 1', cells: [['12']] },
    { id: 'owners', name: "O'Brien", cells: [['5']] },
    { id: 'summary', name: 'Summary', cells: [["='Quarter 1'!A1+'O''Brien'!A1"]] }
  ];
  assert.equal(calculateCell(worksheets[2].cells, 0, 0, new Set(), {
    worksheets,
    activeWorksheetId: 'summary'
  }), 17);
});

test('supports SUM and AVERAGE over ranges on another worksheet', () => {
  const worksheets = [
    { id: 'data', name: 'Data', cells: [['1', '2'], ['3', '4']] },
    { id: 'summary', name: 'Summary', cells: [['=SUM(Data!A1:B2)'], ["=AVERAGE('Data'!A1:B2)"]] }
  ];
  const context = { worksheets, activeWorksheetId: 'summary' };
  assert.equal(calculateCell(worksheets[1].cells, 0, 0, new Set(), context), 10);
  assert.equal(calculateCell(worksheets[1].cells, 1, 0, new Set(), context), 2.5);
});

test('detects circular references that cross worksheet boundaries', () => {
  const worksheets = [
    { id: 'first', name: 'First', cells: [['=Second!A1+1']] },
    { id: 'second', name: 'Second', cells: [['=First!A1+1']] }
  ];
  assert.equal(calculateCell(worksheets[0].cells, 0, 0, new Set(), {
    worksheets,
    activeWorksheetId: 'first'
  }), '#VALUE!');
});

test('returns a formula error for references to unknown worksheets', () => {
  const worksheets = [
    { id: 'summary', name: 'Summary', cells: [['=Missing!A1']] }
  ];
  assert.equal(calculateCell(worksheets[0].cells, 0, 0, new Set(), {
    worksheets,
    activeWorksheetId: 'summary'
  }), '#VALUE!');
});


test('rejects formula ranges larger than the bounded evaluation limit', () => {
  const worksheets = [
    { id: 'data', name: 'Data', cells: [['1']] },
    { id: 'summary', name: 'Summary', cells: [['=SUM(Data!A1:XFD1048576)']] }
  ];
  assert.equal(calculateCell(worksheets[1].cells, 0, 0, new Set(), {
    worksheets,
    activeWorksheetId: 'summary'
  }), '#VALUE!');
});

test('arithmetic and worksheet formulas preserve decimals without a leading zero', () => {
  assert.equal(arithmetic('.5 + .25'), 0.75);
  assert.equal(arithmetic('1. + .5'), 1.5);
  assert.equal(calculateCell([['=.5+1']], 0, 0), 1.5);
});

test('formulas keep hexadecimal and binary-looking cell values as text', () => {
  const cells = [['0xFF', '0b101', '12', '=A1+1', '=SUM(A1:C1)', '=COUNT(A1:C1)', '=COUNTA(A1:C1)']];

  assert.equal(calculateCell(cells, 0, 3), '#VALUE!');
  assert.equal(calculateCell(cells, 0, 4), 12);
  assert.equal(calculateCell(cells, 0, 5), 1);
  assert.equal(calculateCell(cells, 0, 6), 3);
});

test('single-cell aggregate references propagate formula errors like one-cell ranges', () => {
  const cells = [['=Missing!A1', '=SUM(A1)', '=SUM(A1:A1)']];

  assert.equal(calculateCell(cells, 0, 1), '#VALUE!');
  assert.equal(calculateCell(cells, 0, 2), '#VALUE!');
});

test('numeric cell values remain available to direct references and aggregate formulas', () => {
  const cells = [['10', '1.5', '', '=A1+B1', '=SUM(A1:B1)', '=COUNT(A1:B1)']];

  assert.equal(calculateCell(cells, 0, 3), 11.5);
  assert.equal(calculateCell(cells, 0, 4), 11.5);
  assert.equal(calculateCell(cells, 0, 5), 2);
});

test('supports scientific notation constants without confusing exponent digits for cell references', () => {
  const cells = [['=1e3 + 2.5e-1', '3', '=A1+1e2']];

  assert.equal(calculateCell(cells, 0, 0), 1000.25);
  assert.equal(calculateCell(cells, 0, 2), 1100.25);
});
