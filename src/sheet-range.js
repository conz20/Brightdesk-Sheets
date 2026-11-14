(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetRange = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_ROWS = 1_048_576;
  const MAX_COLUMNS = 16_384;
  const MAX_RANGE_CELLS = 250_000;

  function normalizeRange(range, maxCells = MAX_RANGE_CELLS) {
    if (!range || !Number.isInteger(range.top) || !Number.isInteger(range.left) ||
        !Number.isInteger(range.bottom) || !Number.isInteger(range.right) ||
        range.top < 0 || range.left < 0 || range.bottom < range.top || range.right < range.left ||
        range.bottom >= MAX_ROWS || range.right >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid cell range.');
    }
    if (!Number.isSafeInteger(maxCells) || maxCells < 1) {
      throw new TypeError('The spreadsheet range limit is invalid.');
    }
    const rowCount = range.bottom - range.top + 1;
    const columnCount = range.right - range.left + 1;
    if (rowCount > Math.floor(maxCells / columnCount)) {
      throw new RangeError('The selected range exceeds the 250,000-cell limit.');
    }
    return {
      top: range.top,
      left: range.left,
      bottom: range.bottom,
      right: range.right,
      rowCount,
      columnCount,
      cellCount: rowCount * columnCount
    };
  }

  function rangeFromCells(anchor, focus, maxCells = MAX_RANGE_CELLS) {
    if (!anchor || !focus ||
        !Number.isInteger(anchor.row) || !Number.isInteger(anchor.col) ||
        !Number.isInteger(focus.row) || !Number.isInteger(focus.col) ||
        anchor.row < 0 || anchor.col < 0 || focus.row < 0 || focus.col < 0 ||
        anchor.row >= MAX_ROWS || focus.row >= MAX_ROWS ||
        anchor.col >= MAX_COLUMNS || focus.col >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid cell before selecting a range.');
    }
    return normalizeRange({
      top: Math.min(anchor.row, focus.row),
      left: Math.min(anchor.col, focus.col),
      bottom: Math.max(anchor.row, focus.row),
      right: Math.max(anchor.col, focus.col)
    }, maxCells);
  }

  function extractRangeValues(cells, range) {
    if (!Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('The worksheet must contain a valid cell grid.');
    }
    const normalized = normalizeRange(range);
    const result = [];
    for (let row = normalized.top; row <= normalized.bottom; row += 1) {
      const outputRow = [];
      for (let col = normalized.left; col <= normalized.right; col += 1) {
        outputRow.push(String(cells[row]?.[col] ?? ''));
      }
      result.push(outputRow);
    }
    return result;
  }

  function clearRangeValues(cells, range) {
    if (!Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('The worksheet must contain a valid cell grid.');
    }
    const normalized = normalizeRange(range);
    const result = cells.map(row => row.slice());
    for (let row = normalized.top; row <= normalized.bottom && row < result.length; row += 1) {
      for (let col = normalized.left; col <= normalized.right && col < result[row].length; col += 1) {
        result[row][col] = '';
      }
    }
    return result;
  }

  return { MAX_ROWS, MAX_COLUMNS, MAX_RANGE_CELLS, normalizeRange, rangeFromCells, extractRangeValues, clearRangeValues };
});
