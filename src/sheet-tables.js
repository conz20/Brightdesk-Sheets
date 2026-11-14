(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetTables = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_ROWS = 1_048_576;
  const MAX_COLUMNS = 16_384;
  const MAX_TABLE_CELLS = 250_000;
  const MAX_TABLES = 1_000;
  const TABLE_STYLE = 'brightdesk-green';
  const TABLE_HEADER_FILL = '#27845C';
  const TABLE_HEADER_TEXT = '#FFFFFF';
  const TABLE_BAND_FILL = '#EDF7F1';

  function validRange(range) {
    if (!range || !Number.isInteger(range.top) || !Number.isInteger(range.left) ||
        !Number.isInteger(range.bottom) || !Number.isInteger(range.right) ||
        range.top < 0 || range.left < 0 || range.bottom < range.top || range.right < range.left ||
        range.bottom >= MAX_ROWS || range.right >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid table range.');
    }
    const rows = range.bottom - range.top + 1;
    const columns = range.right - range.left + 1;
    if (rows > Math.floor(MAX_TABLE_CELLS / columns)) {
      throw new RangeError('The selected table exceeds the 250,000-cell limit.');
    }
    return {
      top: range.top,
      left: range.left,
      bottom: range.bottom,
      right: range.right
    };
  }

  function validateTableName(value) {
    const name = String(value ?? '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) || /^[A-Z]{1,3}[1-9]\d*$/i.test(name)) {
      throw new TypeError('Enter a valid table name. Use letters, numbers, underscores or periods; do not use a cell reference.');
    }
    if (name.length > 255) throw new TypeError('Table names cannot exceed 255 characters.');
    return name;
  }

  function rangesOverlap(first, second) {
    return first.top <= second.bottom && first.bottom >= second.top &&
      first.left <= second.right && first.right >= second.left;
  }

  function uniqueColumnNames(values) {
    const used = new Set();
    return values.map((raw, index) => {
      const base = String(raw ?? '').trim().slice(0, 255) || 'Column' + (index + 1);
      let candidate = base;
      let suffix = 2;
      while (used.has(candidate.toLocaleLowerCase())) {
        const tail = ' ' + suffix++;
        candidate = base.slice(0, Math.max(1, 255 - tail.length)) + tail;
      }
      used.add(candidate.toLocaleLowerCase());
      return candidate;
    });
  }

  function createTable(tables, cells, range, requestedName, existingTables = []) {
    if (!Array.isArray(tables) || !Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('A valid worksheet and table collection are required.');
    }
    const selected = validRange(range);
    if (selected.bottom >= cells.length || cells.slice(selected.top, selected.bottom + 1)
      .some(row => row.length <= selected.right)) {
      throw new RangeError('The table range must be inside the worksheet.');
    }
    const allTables = [...tables, ...(Array.isArray(existingTables) ? existingTables : [])];
    if (allTables.length >= MAX_TABLES) throw new RangeError('The workbook has reached the 1,000-table limit.');
    const name = validateTableName(requestedName || 'Table' + (allTables.length + 1));
    if (allTables.some(table => String(table?.name || '').toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('A table with that name already exists in this workbook.');
    }
    if (tables.some(table => table?.range && rangesOverlap(selected, table.range))) {
      throw new Error('Table ranges cannot overlap on the same worksheet.');
    }
    const headers = cells[selected.top].slice(selected.left, selected.right + 1);
    const columns = uniqueColumnNames(headers);
    const nextCells = cells.map(row => row.slice());
    columns.forEach((column, index) => { nextCells[selected.top][selected.left + index] = column; });
    const usedIds = new Set(allTables.map(table => table?.id).filter(Boolean));
    let number = 1;
    while (usedIds.has('table-' + number)) number += 1;
    const table = {
      id: 'table-' + number,
      name,
      range: selected,
      columns,
      headerRow: true,
      totalsRow: false,
      style: TABLE_STYLE
    };
    return { tables: [...tables, table], cells: nextCells, table };
  }

  function renameTable(tables, tableId, requestedName, existingTables = []) {
    if (!Array.isArray(tables)) throw new TypeError('A valid table collection is required.');
    const target = tables.find(table => table.id === tableId);
    if (!target) throw new Error('The selected table could not be found.');
    const name = validateTableName(requestedName);
    const allTables = [...tables, ...(Array.isArray(existingTables) ? existingTables : [])];
    if (allTables.some(table => table.id !== tableId && String(table.name || '').toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('A table with that name already exists in this workbook.');
    }
    return tables.map(table => table.id === tableId ? { ...table, name } : { ...table });
  }

  function removeTable(tables, tableId) {
    if (!Array.isArray(tables)) throw new TypeError('A valid table collection is required.');
    return tables.filter(table => table.id !== tableId && table.name !== tableId).map(table => ({ ...table }));
  }

  function findTableAtCell(tables, row, col) {
    if (!Array.isArray(tables) || !Number.isInteger(row) || !Number.isInteger(col)) return null;
    return tables.find(table => {
      const range = table.range;
      return range && row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
    }) || null;
  }

  function cellAddress(row, col) {
    let value = col + 1;
    let label = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label + (row + 1);
  }

  function applyTableStyles(styles, table) {
    if (!table?.range) throw new TypeError('A valid table definition is required.');
    const range = validRange(table.range);
    const next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    for (let row = range.top; row <= range.bottom; row += 1) {
      for (let col = range.left; col <= range.right; col += 1) {
        const address = cellAddress(row, col);
        const current = next[address] && typeof next[address] === 'object' ? { ...next[address] } : {};
        if (row === range.top) {
          next[address] = { ...current, bold: true, fill: TABLE_HEADER_FILL, color: TABLE_HEADER_TEXT };
        } else {
          next[address] = { ...current, fill: (row - range.top) % 2 === 1 ? TABLE_BAND_FILL : null };
        }
      }
    }
    return next;
  }

  return {
    MAX_TABLE_CELLS,
    MAX_TABLES,
    TABLE_STYLE,
    validRange,
    validateTableName,
    createTable,
    renameTable,
    removeTable,
    findTableAtCell,
    applyTableStyles
  };
});
