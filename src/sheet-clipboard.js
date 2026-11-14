(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskSheetClipboard = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAX_CLIPBOARD_CELLS = 250_000;
  const MAX_CLIPBOARD_TEXT = 10 * 1024 * 1024;
  const MAX_ROWS = 1_048_576;
  const MAX_COLUMNS = 16_384;

  function parseClipboardGrid(input, maxCells = MAX_CLIPBOARD_CELLS) {
    if (typeof input !== 'string') throw new TypeError('Clipboard contents must be text.');
    if (input.length > MAX_CLIPBOARD_TEXT) throw new RangeError('Clipboard text exceeds the 10 MB limit.');
    if (!Number.isSafeInteger(maxCells) || maxCells < 1) throw new TypeError('The clipboard cell limit is invalid.');

    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    let quoteClosed = false;
    let fieldStarted = false;
    let cellCount = 0;

    const pushCell = () => {
      cellCount += 1;
      if (cellCount > maxCells) throw new RangeError('Clipboard contents exceed the 250,000-cell limit.');
      row.push(cell);
      cell = '';
      quoteClosed = false;
      fieldStarted = false;
    };
    const pushRow = () => {
      pushCell();
      rows.push(row);
      row = [];
    };

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      const isNewline = character === '\n' || character === '\r';

      if (quoted) {
        if (character === '"') {
          if (input[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
            quoteClosed = true;
          }
        } else {
          cell += character;
        }
        continue;
      }

      if (quoteClosed) {
        if (character === '\t') {
          pushCell();
          continue;
        }
        if (isNewline) {
          if (character === '\r' && input[index + 1] === '\n') index += 1;
          pushRow();
          continue;
        }
        throw new Error('Clipboard contents contain invalid quotation marks.');
      }

      if (character === '"') {
        if (fieldStarted) throw new Error('Clipboard contents contain invalid quotation marks.');
        quoted = true;
        fieldStarted = true;
      } else if (character === '\t') {
        pushCell();
      } else if (isNewline) {
        if (character === '\r' && input[index + 1] === '\n') index += 1;
        pushRow();
      } else {
        cell += character;
        fieldStarted = true;
      }
    }

    if (quoted) throw new Error('Clipboard contents contain invalid quotation marks.');
    if (fieldStarted || row.length || cell.length) {
      pushCell();
      rows.push(row);
    }
    return rows.length ? rows : [['']];
  }

  function serializeClipboardGrid(grid) {
    if (!Array.isArray(grid) || grid.some(row => !Array.isArray(row))) {
      throw new TypeError('The clipboard grid is invalid.');
    }
    return grid.map(row => row.map(value => {
      const text = String(value ?? '');
      return /["\t\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }).join('\t')).join('\r\n');
  }

  function pasteClipboardGrid(cells, startRow, startCol, clipboardGrid, maxCells = MAX_CLIPBOARD_CELLS) {
    if (!Array.isArray(cells) || cells.some(row => !Array.isArray(row))) {
      throw new TypeError('The target worksheet must contain a valid cell grid.');
    }
    if (!Array.isArray(clipboardGrid) || !clipboardGrid.length ||
        clipboardGrid.some(row => !Array.isArray(row))) {
      throw new TypeError('The clipboard grid is invalid.');
    }
    if (!Number.isInteger(startRow) || !Number.isInteger(startCol) ||
        startRow < 0 || startCol < 0 || startRow >= MAX_ROWS || startCol >= MAX_COLUMNS) {
      throw new RangeError('Choose a valid cell before pasting.');
    }
    if (!Number.isSafeInteger(maxCells) || maxCells < 1) throw new TypeError('The worksheet cell limit is invalid.');

    const pasteColumns = clipboardGrid.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    const targetRows = Math.max(1, cells.length, startRow + clipboardGrid.length);
    const existingColumns = cells.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    const targetColumns = Math.max(1, existingColumns, startCol + pasteColumns);
    if (targetRows > MAX_ROWS || targetColumns > MAX_COLUMNS ||
        targetRows > Math.floor(maxCells / targetColumns)) {
      throw new RangeError('The paste would exceed the 250,000-cell limit.');
    }

    const result = cells.map(row => row.slice());
    for (const row of result) {
      while (row.length < targetColumns) row.push('');
    }
    while (result.length < targetRows) result.push(Array(targetColumns).fill(''));

    clipboardGrid.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((value, colOffset) => {
        result[startRow + rowOffset][startCol + colOffset] = String(value ?? '');
      });
    });
    return result;
  }

  return { MAX_CLIPBOARD_CELLS, MAX_CLIPBOARD_TEXT, parseClipboardGrid, serializeClipboardGrid, pasteClipboardGrid };
});
