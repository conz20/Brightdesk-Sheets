(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetNavigation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
'use strict';

const MAX_EXCEL_ROWS = 1_048_576;
const MAX_EXCEL_COLUMNS = 16_384;
const MAX_SHEET_CELLS = 250_000;

function columnLabelToIndex(label) {
  let value = 0;
  for (const character of label.toUpperCase()) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value - 1;
}

function columnIndexToLabel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_EXCEL_COLUMNS) {
    throw new RangeError('The column is outside the supported spreadsheet range.');
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

function parseCellAddress(reference) {
  const value = String(reference ?? '').trim();
  const match = value.match(/^([A-Z]{1,3})([1-9]\d{0,6})$/i);
  if (!match) throw new Error('Enter a valid cell reference, such as A1 or AA20.');
  const col = columnLabelToIndex(match[1]);
  const rowNumber = Number(match[2]);
  if (col < 0 || col >= MAX_EXCEL_COLUMNS || rowNumber > MAX_EXCEL_ROWS) {
    throw new Error('Enter a valid cell reference within the supported spreadsheet range.');
  }
  return { row: rowNumber - 1, col };
}

function formatCellAddress(row, col) {
  if (!Number.isInteger(row) || row < 0 || row >= MAX_EXCEL_ROWS) {
    throw new RangeError('The row is outside the supported spreadsheet range.');
  }
  return `${columnIndexToLabel(col)}${row + 1}`;
}

function getKeyboardNavigationTarget(options = {}) {
  const { row, col, key, shiftKey = false } = options;
  if (!Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || row >= MAX_EXCEL_ROWS || col < 0 || col >= MAX_EXCEL_COLUMNS) {
    return null;
  }

  let nextRow = row;
  let nextCol = col;
  switch (key) {
    case 'Enter':
      nextRow += shiftKey ? -1 : 1;
      break;
    case 'Tab':
      nextCol += shiftKey ? -1 : 1;
      break;
    case 'ArrowUp':
      if (shiftKey) return null;
      nextRow -= 1;
      break;
    case 'ArrowDown':
      if (shiftKey) return null;
      nextRow += 1;
      break;
    case 'ArrowLeft': {
      if (shiftKey) return null;
      const start = options.selectionStart;
      const end = options.selectionEnd;
      if (start !== 0 || end !== 0) return null;
      nextCol -= 1;
      break;
    }
    case 'ArrowRight': {
      if (shiftKey) return null;
      const valueLength = String(options.value ?? '').length;
      if (options.selectionStart !== valueLength || options.selectionEnd !== valueLength) return null;
      nextCol += 1;
      break;
    }
    default:
      return null;
  }

  if (nextRow < 0 || nextRow >= MAX_EXCEL_ROWS || nextCol < 0 || nextCol >= MAX_EXCEL_COLUMNS) {
    return null;
  }
  return { row: nextRow, col: nextCol };
}

function ensureCellExists(cells, row, col, maxCells = MAX_SHEET_CELLS) {
  if (!Array.isArray(cells) || cells.some(line => !Array.isArray(line))) {
    throw new TypeError('The workbook must contain a valid cell grid.');
  }
  if (!Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || col < 0 || row >= MAX_EXCEL_ROWS || col >= MAX_EXCEL_COLUMNS) {
    throw new RangeError('The requested cell is outside the supported spreadsheet range.');
  }
  if (!Number.isSafeInteger(maxCells) || maxCells < 1) {
    throw new TypeError('The spreadsheet cell limit is invalid.');
  }

  const targetRows = Math.max(1, cells.length, row + 1);
  const targetColumns = cells.reduce((maximum, line) => Math.max(maximum, line.length), Math.max(12, col + 1));
  if (targetRows > Math.floor(maxCells / targetColumns)) {
    throw new RangeError('The requested cell exceeds the 250,000-cell limit.');
  }

  for (const line of cells) {
    while (line.length < targetColumns) line.push('');
  }
  while (cells.length < targetRows) cells.push(Array(targetColumns).fill(''));
  return cells[row];
}

function assertGrid(cells) {
  if (!Array.isArray(cells) || cells.some(line => !Array.isArray(line))) {
    throw new TypeError('The worksheet must contain a valid cell grid.');
  }
}

function appendSheetRow(cells, maxCells = MAX_SHEET_CELLS) {
  assertGrid(cells);
  if (!Number.isSafeInteger(maxCells) || maxCells < 1) throw new TypeError('The spreadsheet cell limit is invalid.');
  const columns = Math.max(1, cells.reduce((maximum, line) => Math.max(maximum, line.length), 0));
  const rows = Math.max(1, cells.length) + 1;
  if (rows > MAX_EXCEL_ROWS) throw new RangeError('The worksheet has reached the 1,048,576-row limit.');
  if (rows > Math.floor(maxCells / columns)) throw new RangeError('Adding a row would exceed the 250,000-cell limit.');
  const result = cells.map(line => line.slice());
  result.push(Array(columns).fill(''));
  return result;
}

function appendSheetColumn(cells, maxCells = MAX_SHEET_CELLS) {
  assertGrid(cells);
  if (!Number.isSafeInteger(maxCells) || maxCells < 1) throw new TypeError('The spreadsheet cell limit is invalid.');
  const rows = Math.max(1, cells.length);
  const currentColumns = cells.reduce((maximum, line) => Math.max(maximum, line.length), 0);
  const columns = currentColumns + 1;
  if (columns > MAX_EXCEL_COLUMNS) throw new RangeError('The worksheet has reached the 16,384-column limit.');
  if (rows > Math.floor(maxCells / columns)) throw new RangeError('Adding a column would exceed the 250,000-cell limit.');
  const result = cells.map(line => {
    const next = line.slice();
    while (next.length < columns) next.push('');
    return next;
  });
  if (!result.length) result.push(['']);
  return result;
}

return {
  MAX_EXCEL_ROWS,
  MAX_EXCEL_COLUMNS,
  MAX_SHEET_CELLS,
  columnLabelToIndex,
  columnIndexToLabel,
  parseCellAddress,
  formatCellAddress,
  getKeyboardNavigationTarget,
  ensureCellExists,
  appendSheetRow,
  appendSheetColumn
};
});
