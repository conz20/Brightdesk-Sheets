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
  const targetColumns = Math.max(12, col + 1, ...cells.map(line => line.length));
  if (targetRows > Math.floor(maxCells / targetColumns)) {
    throw new RangeError('The requested cell exceeds the 250,000-cell limit.');
  }

  for (const line of cells) {
    while (line.length < targetColumns) line.push('');
  }
  while (cells.length < targetRows) cells.push(Array(targetColumns).fill(''));
  return cells[row];
}

module.exports = {
  MAX_EXCEL_ROWS,
  MAX_EXCEL_COLUMNS,
  MAX_SHEET_CELLS,
  columnLabelToIndex,
  columnIndexToLabel,
  parseCellAddress,
  formatCellAddress,
  ensureCellExists
};
