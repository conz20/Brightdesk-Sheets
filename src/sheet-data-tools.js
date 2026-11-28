(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetDataTools = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_COLUMNS = 16_384;
  const MAX_FILTER_VALUES = 250_000;
  const MAX_CELL_TEXT = 32_767;
  const MAX_ROWS = 1_048_576;
  const MAX_RANGE_CELLS = 250_000;
  const cellAddressPattern = /^([A-Z]{1,3})([1-9]\d*)$/i;
  const formulaReferencePattern = /(?<![A-Z0-9_.])(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!([A-Z]{1,3})([1-9]\d*)(?::([A-Z]{1,3})([1-9]\d*))?|(?<![A-Z0-9_.])([A-Z]{1,3})([1-9]\d*)(?::([A-Z]{1,3})([1-9]\d*))?/gi;

  function createAutoFilterState() {
    return { enabled: false, filters: {} };
  }

  function normalizeAutoFilterState(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const filters = {};
    let totalValues = 0;
    if (source.filters && typeof source.filters === 'object' && !Array.isArray(source.filters)) {
      for (const [rawColumn, rawValues] of Object.entries(source.filters)) {
        if (!/^(?:0|[1-9]\d*)$/.test(rawColumn)) continue;
        const column = Number(rawColumn);
        if (!Number.isSafeInteger(column) || column >= MAX_COLUMNS || !Array.isArray(rawValues)) continue;
        const values = [];
        const seen = new Set();
        for (const rawValue of rawValues) {
          if (typeof rawValue !== 'string' || rawValue.length > MAX_CELL_TEXT || seen.has(rawValue)) continue;
          if (totalValues >= MAX_FILTER_VALUES) break;
          seen.add(rawValue);
          values.push(rawValue);
          totalValues += 1;
        }
        filters[String(column)] = values;
      }
    }
    return { enabled: source.enabled === true, filters };
  }

  function assertGrid(cells) {
    if (!Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('The worksheet must contain a valid cell grid.');
    }
  }

  function assertColumn(column, cells) {
    if (!Number.isInteger(column) || column < 0 || column >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid worksheet column.');
    }
    const maxColumns = cells.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    if (column >= Math.max(1, maxColumns)) {
      throw new RangeError('The selected column is outside the worksheet grid.');
    }
  }

  function resolveValue(value, row, col, resolver) {
    if (typeof resolver !== 'function') return value == null ? '' : String(value);
    try {
      const result = resolver({ value, row, col });
      return result == null ? '' : String(result);
    } catch {
      return value == null ? '' : String(value);
    }
  }

  function compareValues(left, right) {
    const a = String(left ?? '');
    const b = String(right ?? '');
    if (a === '' || b === '') {
      if (a === b) return 0;
      return a === '' ? 1 : -1;
    }
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  function getUniqueColumnValues(cells, column, options = {}) {
    assertGrid(cells);
    assertColumn(column, cells);
    const headerRow = Number.isInteger(options.headerRow) && options.headerRow >= 0 ? options.headerRow : 0;
    const unique = new Set();
    for (let row = headerRow + 1; row < cells.length; row += 1) {
      unique.add(resolveValue(cells[row][column], row, column, options.resolveValue));
    }
    return [...unique].sort(compareValues);
  }

  function setColumnFilter(state, column, selectedValues) {
    if (!Number.isInteger(column) || column < 0 || column >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid worksheet column.');
    }
    if (!Array.isArray(selectedValues) || selectedValues.some(value => typeof value !== 'string' || value.length > MAX_CELL_TEXT)) {
      throw new TypeError('The selected filter values are invalid.');
    }
    const next = normalizeAutoFilterState(state);
    next.enabled = true;
    next.filters[String(column)] = [...new Set(selectedValues)];
    return next;
  }

  function setAutoFilterEnabled(state, enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('The filter state must be enabled or disabled.');
    const next = normalizeAutoFilterState(state);
    next.enabled = enabled;
    return next;
  }

  function clearColumnFilter(state, column) {
    if (!Number.isInteger(column) || column < 0 || column >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid worksheet column.');
    }
    const next = normalizeAutoFilterState(state);
    delete next.filters[String(column)];
    return next;
  }

  function clearAllColumnFilters(state) {
    const next = normalizeAutoFilterState(state);
    next.filters = {};
    return next;
  }

  function getVisibleRowIndexes(cells, state, options = {}) {
    assertGrid(cells);
    const filter = normalizeAutoFilterState(state);
    const headerRow = Number.isInteger(options.headerRow) && options.headerRow >= 0 ? options.headerRow : 0;
    const indexes = [];
    for (let row = 0; row < cells.length; row += 1) {
      if (!filter.enabled || !Object.keys(filter.filters).length || row <= headerRow) {
        indexes.push(row);
        continue;
      }
      let visible = true;
      for (const [columnText, selectedValues] of Object.entries(filter.filters)) {
        const column = Number(columnText);
        const value = resolveValue(cells[row][column], row, column, options.resolveValue);
        if (!selectedValues.includes(value)) {
          visible = false;
          break;
        }
      }
      if (visible) indexes.push(row);
    }
    return indexes;
  }

  function translateRangeReference(firstColumn, firstRowNumber, lastColumn, lastRowNumber, destinationBySourceRow, headerRow, prefix) {
    const firstRow = Number(firstRowNumber) - 1;
    const lastRow = Number(lastRowNumber) - 1;
    const firstColumnIndex = parseCellAddress(firstColumn + '1')?.column ?? -1;
    const lastColumnIndex = parseCellAddress(lastColumn + '1')?.column ?? -1;
    const rowCount = Math.abs(lastRow - firstRow) + 1;
    const columnCount = Math.abs(lastColumnIndex - firstColumnIndex) + 1;
    if (!Number.isSafeInteger(firstRow) || !Number.isSafeInteger(lastRow) ||
        firstRow < 0 || lastRow < 0 || firstRow >= MAX_ROWS || lastRow >= MAX_ROWS ||
        firstColumnIndex < 0 || lastColumnIndex < 0 ||
        firstColumnIndex >= MAX_COLUMNS || lastColumnIndex >= MAX_COLUMNS ||
        rowCount > Math.floor(MAX_RANGE_CELLS / columnCount)) {
      return prefix + firstColumn + firstRowNumber + ':' + lastColumn + lastRowNumber;
    }
    const rowStep = firstRow <= lastRow ? 1 : -1;
    const targetRows = [];

    for (let sourceRow = firstRow; rowStep > 0 ? sourceRow <= lastRow : sourceRow >= lastRow; sourceRow += rowStep) {
      const targetRow = sourceRow > headerRow ? destinationBySourceRow.get(sourceRow) : undefined;
      targetRows.push(targetRow === undefined ? sourceRow : targetRow);
    }

    const uniqueRows = new Set(targetRows);
    const minimumRow = targetRows.reduce((minimum, row) => Math.min(minimum, row), Infinity);
    const maximumRow = targetRows.reduce((maximum, row) => Math.max(maximum, row), -Infinity);
    const contiguous = uniqueRows.size === targetRows.length && maximumRow - minimumRow + 1 === targetRows.length;

    if (contiguous) {
      return prefix + firstColumn + (targetRows[0] + 1) + ':' + lastColumn + (targetRows[targetRows.length - 1] + 1);
    }

    const segments = [];
    let segmentStart = targetRows[0];
    let previousRow = targetRows[0];
    let direction = 0;
    for (let index = 1; index < targetRows.length; index += 1) {
      const currentRow = targetRows[index];
      const difference = currentRow - previousRow;
      if (Math.abs(difference) === 1 && (!direction || direction === difference)) {
        direction = difference;
        previousRow = currentRow;
        continue;
      }
      segments.push([segmentStart, previousRow]);
      segmentStart = currentRow;
      previousRow = currentRow;
      direction = 0;
    }
    segments.push([segmentStart, previousRow]);

    return segments.map(([startRow, endRow]) => {
      const firstAddress = firstColumn + (startRow + 1);
      const lastAddress = lastColumn + (endRow + 1);
      const range = startRow === endRow && firstColumn === lastColumn
        ? firstAddress
        : firstAddress + ':' + lastAddress;
      return prefix + range;
    }).join(',');
  }

  function translateFormulaRow(value, destinationBySourceRow, worksheetName, headerRow = 0, includeUnqualified = true) {
    const formula = String(value ?? '');
    if (!formula.startsWith('=') || !(destinationBySourceRow instanceof Map)) return formula;
    return formula.replace(formulaReferencePattern,
      (match, quotedSheet, plainSheet, crossColumn, crossRow, crossLastColumn, crossLastRow, localColumn, localRow, localLastColumn, localLastRow) => {
        const explicitSheet = quotedSheet !== undefined ? quotedSheet.replace(/''/g, "'") : plainSheet;
        if ((!explicitSheet && !includeUnqualified) ||
            (explicitSheet && (!worksheetName || explicitSheet.toLocaleLowerCase() !== String(worksheetName).toLocaleLowerCase()))) {
          return match;
        }
        const prefix = quotedSheet !== undefined
          ? "'" + quotedSheet + "'!"
          : (plainSheet ? plainSheet + '!' : '');
        const firstColumn = crossColumn || localColumn;
        const firstRowNumber = crossRow || localRow;
        const lastColumn = crossLastColumn || localLastColumn;
        const lastRowNumber = crossLastRow || localLastRow;
        if (lastColumn && lastRowNumber) {
          return translateRangeReference(
            firstColumn, firstRowNumber, lastColumn, lastRowNumber,
            destinationBySourceRow, headerRow, prefix
          );
        }
        const sourceRow = Number(firstRowNumber) - 1;
        const targetRow = sourceRow > headerRow ? destinationBySourceRow.get(sourceRow) : undefined;
        return prefix + firstColumn + (targetRow === undefined ? sourceRow + 1 : targetRow + 1);
      });
  }

  function translateExternalFormulaRow(value, destinationBySourceRow, worksheetName, headerRow = 0) {
    return translateFormulaRow(value, destinationBySourceRow, worksheetName, headerRow, false);
  }

  function parseCellAddress(address) {
    const match = String(address).match(cellAddressPattern);
    if (!match) return null;
    let column = 0;
    for (const character of match[1].toUpperCase()) column = column * 26 + character.charCodeAt(0) - 64;
    return { column: column - 1, row: Number(match[2]) - 1, columnLabel: match[1].toUpperCase() };
  }

  function sortWorksheet(cells, styles, column, options = {}) {
    assertGrid(cells);
    assertColumn(column, cells);
    const headerRow = Number.isInteger(options.headerRow) ? options.headerRow : 0;
    if (headerRow < 0 || headerRow >= Math.max(1, cells.length)) {
      throw new RangeError('Choose a valid worksheet header row.');
    }
    const descending = options.descending === true;
    const resolve = options.resolveValue;
    const sorted = cells.slice(headerRow + 1).map((row, offset) => ({
      sourceRow: headerRow + 1 + offset,
      row: row.slice(),
      value: resolveValue(row[column], headerRow + 1 + offset, column, resolve)
    }));
    sorted.sort((left, right) => {
      const comparison = compareValues(left.value, right.value);
      if (comparison === 0) return left.sourceRow - right.sourceRow;
      const leftBlank = left.value === '';
      const rightBlank = right.value === '';
      if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
      return descending ? -comparison : comparison;
    });

    const nextCells = cells.slice(0, headerRow + 1).map(row => row.slice());
    const destinationBySourceRow = new Map();
    sorted.forEach((entry, index) => {
      destinationBySourceRow.set(entry.sourceRow, headerRow + 1 + index);
    });
    sorted.forEach(entry => {
      const targetRow = destinationBySourceRow.get(entry.sourceRow);
      nextCells.push(entry.row.map(value => typeof value === 'string'
        ? translateFormulaRow(value, destinationBySourceRow, options.worksheetName, headerRow)
        : value));
    });

    const nextStyles = {};
    const sourceStyles = styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {};
    for (const [address, style] of Object.entries(sourceStyles)) {
      const parsed = parseCellAddress(address);
      if (!parsed) {
        nextStyles[address] = style && typeof style === 'object' ? { ...style } : style;
        continue;
      }
      const targetRow = parsed.row > headerRow
        ? (destinationBySourceRow.get(parsed.row) ?? parsed.row)
        : parsed.row;
      const targetAddress = parsed.columnLabel + (targetRow + 1);
      nextStyles[targetAddress] = style && typeof style === 'object' ? { ...style } : style;
    }
    return { cells: nextCells, styles: nextStyles, destinationBySourceRow };
  }

  return {
    MAX_FILTER_VALUES,
    createAutoFilterState,
    normalizeAutoFilterState,
    getUniqueColumnValues,
    setColumnFilter,
    setAutoFilterEnabled,
    clearColumnFilter,
    clearAllColumnFilters,
    getVisibleRowIndexes,
    translateFormulaRow,
    translateExternalFormulaRow,
    sortWorksheet
  };
});
