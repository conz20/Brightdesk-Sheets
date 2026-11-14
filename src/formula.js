(function (root) {
  const MAX_ROWS = 1_048_576;
  const MAX_COLUMNS = 16_384;
  const MAX_RANGE_CELLS = 250_000;

  function columnIndex(label) {
    let value = 0;
    for (const ch of label.toUpperCase()) value = value * 26 + ch.charCodeAt(0) - 64;
    return value - 1;
  }

  function arithmetic(expression) {
    const source = String(expression ?? '');
    const tokens = [];
    const tokenPattern = /\s*(\d+(?:\.\d*)?|\.\d+|[()+\-*/%])/gy;
    let position = 0;
    while (position < source.length) {
      tokenPattern.lastIndex = position;
      const match = tokenPattern.exec(source);
      if (!match) {
        if (!source.slice(position).trim()) break;
        throw new Error('Invalid formula');
      }
      tokens.push(match[1]);
      position = tokenPattern.lastIndex;
    }
    let at = 0;
    function factor() {
      const token = tokens[at++];
      if (token === '-') return -factor();
      if (token === '+') return factor();
      if (token === '(') {
        const value = expr();
        if (tokens[at++] !== ')') throw new Error('Missing closing parenthesis');
        return value;
      }
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error('Invalid number');
      return value;
    }
    function term() {
      let value = factor();
      while (['*', '/', '%'].includes(tokens[at])) {
        const op = tokens[at++], next = factor();
        value = op === '*' ? value * next : op === '/' ? value / next : value % next;
      }
      return value;
    }
    function expr() {
      let value = term();
      while (['+', '-'].includes(tokens[at])) {
        const op = tokens[at++], next = term();
        value = op === '+' ? value + next : value - next;
      }
      return value;
    }
    if (!tokens.length) return 0;
    const value = expr();
    if (at !== tokens.length) throw new Error('Invalid formula');
    return value;
  }

  function splitArguments(value) {
    const result = [];
    let start = 0;
    let quoted = false;
    for (let index = 0; index < value.length; index++) {
      if (value[index] === "'") {
        if (quoted && value[index + 1] === "'") { index += 1; continue; }
        quoted = !quoted;
      } else if (value[index] === ',' && !quoted) {
        result.push(value.slice(start, index).trim());
        start = index + 1;
      }
    }
    if (quoted) throw new Error('Invalid quoted worksheet name');
    result.push(value.slice(start).trim());
    return result;
  }

  function parseReference(reference) {
    const value = String(reference).trim();
    const crossSheet = value.match(/^(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!([A-Z]+)([1-9]\d*)$/i);
    const localSheet = value.match(/^([A-Z]+)([1-9]\d*)$/i);
    if (!crossSheet && !localSheet) throw new Error('Invalid cell reference');
    const sheetName = crossSheet
      ? (crossSheet[1] ? crossSheet[1].replace(/''/g, "'") : crossSheet[2])
      : null;
    const columnLabel = crossSheet ? crossSheet[3] : localSheet[1];
    const rowNumber = Number(crossSheet ? crossSheet[4] : localSheet[2]);
    const col = columnIndex(columnLabel);
    const row = rowNumber - 1;
    if (col < 0 || col >= MAX_COLUMNS || row < 0 || row >= MAX_ROWS) throw new Error('Cell reference is outside the supported range');
    return { sheetName, row, col };
  }

  function parseRange(reference) {
    const value = String(reference).trim();
    const crossSheet = value.match(/^(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!([A-Z]+)([1-9]\d*):([A-Z]+)([1-9]\d*)$/i);
    const localSheet = value.match(/^([A-Z]+)([1-9]\d*):([A-Z]+)([1-9]\d*)$/i);
    if (!crossSheet && !localSheet) return null;
    const sheetName = crossSheet
      ? (crossSheet[1] ? crossSheet[1].replace(/''/g, "'") : crossSheet[2])
      : null;
    const firstColumn = crossSheet ? crossSheet[3] : localSheet[1];
    const firstRowNumber = Number(crossSheet ? crossSheet[4] : localSheet[2]);
    const lastColumn = crossSheet ? crossSheet[5] : localSheet[3];
    const lastRowNumber = Number(crossSheet ? crossSheet[6] : localSheet[4]);
    const firstCol = columnIndex(firstColumn);
    const lastCol = columnIndex(lastColumn);
    const firstRow = firstRowNumber - 1;
    const lastRow = lastRowNumber - 1;
    if (firstCol < 0 || lastCol < 0 || firstCol >= MAX_COLUMNS || lastCol >= MAX_COLUMNS ||
        firstRow < 0 || lastRow < 0 || firstRow >= MAX_ROWS || lastRow >= MAX_ROWS) {
      throw new Error('Cell range is outside the supported spreadsheet range');
    }
    const rowCount = Math.abs(lastRow - firstRow) + 1;
    const columnCount = Math.abs(lastCol - firstCol) + 1;
    if (rowCount * columnCount > MAX_RANGE_CELLS) throw new Error('Formula range exceeds the 250,000-cell limit');
    return {
      sheetName,
      firstRow: Math.min(firstRow, lastRow),
      lastRow: Math.max(firstRow, lastRow),
      firstCol: Math.min(firstCol, lastCol),
      lastCol: Math.max(firstCol, lastCol)
    };
  }

  function calculateCell(cells, row, col, stack = new Set(), context = {}) {
    const raw = String(cells?.[row]?.[col] ?? '').trim();
    if (!raw.startsWith('=')) return raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : (raw || '');

    const currentSheetId = context.activeWorksheetId || '__current__';
    const id = `${currentSheetId}:${row}:${col}`;
    if (stack.has(id)) return '#CYCLE!';
    stack.add(id);

    function resolveWorksheet(sheetName) {
      if (!sheetName) {
        return { id: currentSheetId, name: context.activeWorksheetName || '', cells };
      }
      const target = Array.isArray(context.worksheets)
        ? context.worksheets.find(sheet => String(sheet.name || '').toLocaleLowerCase() === sheetName.toLocaleLowerCase())
        : null;
      if (!target || !Array.isArray(target.cells)) throw new Error(`Worksheet not found: ${sheetName}`);
      if (target.id === currentSheetId) return { id: currentSheetId, name: target.name, cells };
      return { id: target.id || target.name, name: target.name, cells: target.cells };
    }

    function getRef(reference, sheetName = null) {
      const parsed = parseReference(reference);
      if (sheetName) parsed.sheetName = sheetName;
      const target = resolveWorksheet(parsed.sheetName);
      return calculateCell(target.cells, parsed.row, parsed.col, stack, {
        ...context,
        activeWorksheetId: target.id,
        activeWorksheetName: target.name
      });
    }

    function getRange(reference) {
      const parsed = parseRange(reference);
      if (!parsed) return [getRef(reference)];
      const target = resolveWorksheet(parsed.sheetName);
      const values = [];
      for (let r = parsed.firstRow; r <= parsed.lastRow; r++) {
        for (let c = parsed.firstCol; c <= parsed.lastCol; c++) {
          const result = calculateCell(target.cells, r, c, stack, {
            ...context,
            activeWorksheetId: target.id,
            activeWorksheetName: target.name
          });
          if (typeof result === 'string' && result.startsWith('#')) throw new Error('Referenced cell contains an error');
          values.push(result);
        }
      }
      return values;
    }

    try {
      const formula = raw.slice(1).trim();
      const fn = formula.match(/^(SUM|AVERAGE|MIN|MAX|COUNT|COUNTA)\((.*)\)$/i);
      let result;
      if (fn) {
        const values = splitArguments(fn[2]).flatMap(getRange);
        const numbers = values
          .filter(value => value !== '' && value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === ''))
          .map(Number)
          .filter(Number.isFinite);
        switch (fn[1].toUpperCase()) {
          case 'SUM': result = numbers.reduce((sum, number) => sum + number, 0); break;
          case 'AVERAGE': result = numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : 0; break;
          case 'MIN': result = numbers.length ? numbers.reduce((smallest, number) => Math.min(smallest, number), Infinity) : 0; break;
          case 'MAX': result = numbers.length ? numbers.reduce((largest, number) => Math.max(largest, number), -Infinity) : 0; break;
          case 'COUNT': result = numbers.length; break;
          case 'COUNTA': result = values.filter(value => value !== '' && value !== null && value !== undefined).length; break;
        }
      } else {
        const referencePattern = /(?:'((?:[^']|'')+)'|([A-Z_][A-Z0-9_.]*))!([A-Z]+[1-9]\d*)|([A-Z]+[1-9]\d*)/gi;
        const expression = formula.replace(referencePattern, (match, quotedSheet, plainSheet, crossSheetAddress, localAddress) => {
          const value = getRef(crossSheetAddress || localAddress, quotedSheet ? quotedSheet.replace(/''/g, "'") : (plainSheet || null));
          if (typeof value !== 'number') throw new Error('Cell is not numeric');
          return String(value);
        });
        if (!/^[\d\s.+\-*/()%]+$/.test(expression)) throw new Error('Unsupported expression');
        result = arithmetic(expression);
      }
      return Number.isFinite(result) ? Number(result.toFixed(8)) : '#VALUE!';
    } catch {
      return '#VALUE!';
    } finally {
      stack.delete(id);
    }
  }

  const api = { columnIndex, arithmetic, calculateCell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskFormula = api;
})(typeof window !== 'undefined' ? window : globalThis);
