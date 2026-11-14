(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetFill = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_ROWS = 1_048_576;
  const MAX_COLUMNS = 16_384;
  const MAX_CELLS = 250_000;

  function normalizeRange(range) {
    if (!range || !Number.isInteger(range.top) || !Number.isInteger(range.left) ||
        !Number.isInteger(range.bottom) || !Number.isInteger(range.right) ||
        range.top < 0 || range.left < 0 || range.bottom < range.top || range.right < range.left ||
        range.bottom >= MAX_ROWS || range.right >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid cell range.');
    }
    const rowCount = range.bottom - range.top + 1;
    const columnCount = range.right - range.left + 1;
    if (rowCount > Math.floor(MAX_CELLS / columnCount)) {
      throw new RangeError('The selected range exceeds the 250,000-cell limit.');
    }
    return { top: range.top, left: range.left, bottom: range.bottom, right: range.right, rowCount, columnCount };
  }

  function columnToIndex(label) {
    let value = 0;
    for (const character of String(label).toUpperCase()) {
      value = value * 26 + character.charCodeAt(0) - 64;
    }
    return value - 1;
  }

  function columnToLabel(index) {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_COLUMNS) {
      throw new RangeError('The formula reference is outside the supported spreadsheet range.');
    }
    let value = index + 1;
    let label = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  }

  function shiftReference(column, rowNumber, rowOffset, columnOffset) {
    const row = Number(rowNumber) - 1 + rowOffset;
    const col = columnToIndex(column) + columnOffset;
    if (!Number.isInteger(row) || row < 0 || row >= MAX_ROWS || col < 0 || col >= MAX_COLUMNS) {
      throw new RangeError('A filled formula reference would move outside the supported spreadsheet range.');
    }
    return columnToLabel(col) + (row + 1);
  }

  function translateFormulaReferences(value, rowOffset, columnOffset) {
    const formula = String(value ?? '');
    if (!formula.startsWith('=')) return formula;
    if (!Number.isInteger(rowOffset) || !Number.isInteger(columnOffset)) {
      throw new TypeError('Formula fill offsets must be whole numbers.');
    }
    const referencePattern = /(?:(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!)?([A-Z]{1,3})([1-9]\d*)(?::([A-Z]{1,3})([1-9]\d*))?/gi;
    return '=' + formula.slice(1).replace(referencePattern, (match, quotedSheet, plainSheet, firstColumn, firstRow, lastColumn, lastRow) => {
      const prefix = quotedSheet !== undefined ? "'" + quotedSheet + "'!" : (plainSheet ? plainSheet + '!' : '');
      const first = shiftReference(firstColumn, firstRow, rowOffset, columnOffset);
      const last = lastColumn ? ':' + shiftReference(lastColumn, lastRow, rowOffset, columnOffset) : '';
      return prefix + first + last;
    });
  }

  function prepareGrid(cells, range) {
    if (!Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('The worksheet must contain a valid cell grid.');
    }
    const selected = normalizeRange(range);
    const targetRows = Math.max(1, cells.length, selected.bottom + 1);
    const currentColumns = cells.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    const targetColumns = Math.max(1, currentColumns, selected.right + 1);
    if (targetRows > MAX_ROWS || targetColumns > MAX_COLUMNS ||
        targetRows > Math.floor(MAX_CELLS / targetColumns)) {
      throw new RangeError('The fill would exceed the 250,000-cell limit.');
    }
    const result = cells.map(row => row.slice());
    for (const row of result) while (row.length < targetColumns) row.push('');
    while (result.length < targetRows) result.push(Array(targetColumns).fill(''));
    return { selected, result };
  }

  function fillRangeDown(cells, range) {
    const { selected, result } = prepareGrid(cells, range);
    for (let row = selected.top + 1; row <= selected.bottom; row += 1) {
      for (let col = selected.left; col <= selected.right; col += 1) {
        const source = result[selected.top][col];
        result[row][col] = translateFormulaReferences(source, row - selected.top, 0);
      }
    }
    return result;
  }

  function fillRangeRight(cells, range) {
    const { selected, result } = prepareGrid(cells, range);
    for (let row = selected.top; row <= selected.bottom; row += 1) {
      for (let col = selected.left + 1; col <= selected.right; col += 1) {
        const source = result[row][selected.left];
        result[row][col] = translateFormulaReferences(source, 0, col - selected.left);
      }
    }
    return result;
  }

  return { MAX_ROWS, MAX_COLUMNS, MAX_CELLS, normalizeRange, translateFormulaReferences, fillRangeDown, fillRangeRight };
});
