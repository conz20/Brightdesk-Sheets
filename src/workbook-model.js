(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskWorkbookModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
'use strict';

const DEFAULT_ROW_COUNT = 20;
const DEFAULT_COLUMN_COUNT = 12;
const MAX_WORKSHEETS = 256;

function cloneGrid(cells, fallback = createEmptyGrid()) {
  if (!Array.isArray(cells)) return cloneGrid(fallback, createEmptyGrid());
  return cells.map(row => Array.isArray(row) ? row.map(value => value ?? '') : []);
}

function createEmptyGrid(rows = DEFAULT_ROW_COUNT, columns = DEFAULT_COLUMN_COUNT) {
  return Array.from({ length: rows }, () => Array(columns).fill(''));
}

function cloneCellStyles(styles) {
  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) return {};
  const result = {};
  const numberFormats = new Set(['general', 'number', 'currency', 'percent', 'date']);
  for (const [address, value] of Object.entries(styles)) {
    if (!/^[A-Z]{1,3}[1-9]\d*$/i.test(address) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const style = {};
    for (const key of ['bold', 'italic', 'underline']) {
      if (typeof value[key] === 'boolean') style[key] = value[key];
    }
    for (const key of ['fill', 'color']) {
      if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) style[key] = value[key].toUpperCase();
    }
    if (numberFormats.has(value.numberFormat)) style.numberFormat = value.numberFormat;
    if (Object.keys(style).length) result[address.toUpperCase()] = style;
  }
  return result;
}

function cloneAutoFilterState(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const filters = {};
  let valueCount = 0;
  if (source.filters && typeof source.filters === 'object' && !Array.isArray(source.filters)) {
    for (const [column, rawValues] of Object.entries(source.filters)) {
      if (!/^(?:0|[1-9]\d*)$/.test(column) || Number(column) >= 16384 || !Array.isArray(rawValues)) continue;
      const values = [];
      const seen = new Set();
      for (const raw of rawValues) {
        if (typeof raw !== 'string' || raw.length > 32767 || seen.has(raw) || valueCount >= 250000) continue;
        seen.add(raw);
        values.push(raw);
        valueCount += 1;
      }
      filters[column] = values;
    }
  }
  return { enabled: source.enabled === true, filters };
}

function cloneTables(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const ids = new Set();
  const names = new Set();
  for (const raw of value.slice(0, 1000)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        typeof raw.id !== 'string' || !raw.id.trim() ||
        typeof raw.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(raw.name) ||
        !raw.range || !Number.isInteger(raw.range.top) || !Number.isInteger(raw.range.left) ||
        !Number.isInteger(raw.range.bottom) || !Number.isInteger(raw.range.right) ||
        raw.range.top < 0 || raw.range.left < 0 || raw.range.bottom < raw.range.top ||
        raw.range.right < raw.range.left ||
        !Array.isArray(raw.columns) ||
        raw.columns.length !== raw.range.right - raw.range.left + 1 ||
        raw.columns.some(name => typeof name !== 'string' || !name.trim())) continue;
    const nameKey = raw.name.toLocaleLowerCase();
    if (ids.has(raw.id) || names.has(nameKey)) continue;
    ids.add(raw.id);
    names.add(nameKey);
    result.push({
      id: raw.id,
      name: raw.name,
      range: {
        top: raw.range.top,
        left: raw.range.left,
        bottom: raw.range.bottom,
        right: raw.range.right
      },
      columns: raw.columns.slice(),
      headerRow: raw.headerRow !== false,
      totalsRow: raw.totalsRow === true,
      style: 'brightdesk-green'
    });
  }
  return result;
}

function makeUniqueName(candidate, usedNames) {
  const base = String(candidate || '').trim().slice(0, 31) || 'Sheet';
  if (!usedNames.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (true) {
    const tail = ` (${suffix})`;
    const name = `${base.slice(0, 31 - tail.length)}${tail}`;
    if (!usedNames.has(name.toLocaleLowerCase())) return name;
    suffix += 1;
  }
}

function normalizeWorkbook(document, fallbackCells = createEmptyGrid()) {
  const source = document && typeof document === 'object' ? document : {};
  const normalized = { ...source };
  const sourceSheets = Array.isArray(source.worksheets) && source.worksheets.length
    ? source.worksheets
    : [{ id: 'sheet-1', name: 'Sheet1', cells: source.cells || fallbackCells }];
  if (sourceSheets.length > MAX_WORKSHEETS) {
    throw new RangeError(`A workbook cannot contain more than ${MAX_WORKSHEETS} worksheets.`);
  }
  const requestedActiveId = typeof source.activeWorksheetId === 'string' ? source.activeWorksheetId : '';
  const requestedActiveIndex = sourceSheets.findIndex(sheet => sheet?.id === requestedActiveId);
  const activeStyleIndex = requestedActiveIndex >= 0 ? requestedActiveIndex : 0;
  const usedIds = new Set();
  const usedNames = new Set();
  normalized.worksheets = sourceSheets.map((sheet, index) => {
    const rawId = typeof sheet?.id === 'string' && sheet.id.trim() ? sheet.id.trim() : `sheet-${index + 1}`;
    let id = rawId;
    let idSuffix = 2;
    while (usedIds.has(id)) id = `${rawId}-${idSuffix++}`;
    usedIds.add(id);

    const requestedName = typeof sheet?.name === 'string' && sheet.name.trim() ? sheet.name.trim() : `Sheet${index + 1}`;
    const name = makeUniqueName(requestedName, usedNames);
    usedNames.add(name.toLocaleLowerCase());
    return {
      id,
      name,
      cells: cloneGrid(sheet?.cells, fallbackCells),
      styles: cloneCellStyles(sheet?.styles ?? (index === activeStyleIndex ? source.styles : null)),
      autoFilter: cloneAutoFilterState(sheet?.autoFilter ?? (index === activeStyleIndex ? source.autoFilter : null)),
      tables: cloneTables(sheet?.tables ?? (index === activeStyleIndex ? source.tables : null))
    };
  });

  const active = normalized.worksheets.find(sheet => sheet.id === requestedActiveId) || normalized.worksheets[0];
  normalized.activeWorksheetId = active.id;
  // Keep the legacy `cells` property as the active-sheet view for older readers.
  normalized.cells = cloneGrid(active.cells, fallbackCells);
  normalized.styles = cloneCellStyles(active.styles);
  normalized.autoFilter = cloneAutoFilterState(active.autoFilter);
  normalized.tables = cloneTables(active.tables);
  return normalized;
}

function syncActiveWorksheet(document) {
  if (!document || !Array.isArray(document.worksheets) || !document.worksheets.length) {
    throw new Error('The workbook has no worksheets to update.');
  }
  const active = document.worksheets.find(sheet => sheet.id === document.activeWorksheetId);
  if (!active) throw new Error('The active worksheet could not be found.');
  active.cells = cloneGrid(document.cells);
  active.styles = cloneCellStyles(document.styles);
  active.autoFilter = cloneAutoFilterState(document.autoFilter);
  active.tables = cloneTables(document.tables);
  return document;
}

function activateWorksheet(document, worksheetId) {
  syncActiveWorksheet(document);
  const target = document.worksheets.find(sheet => sheet.id === worksheetId);
  if (!target) throw new Error('The selected worksheet could not be found.');
  document.activeWorksheetId = target.id;
  document.cells = cloneGrid(target.cells);
  document.styles = cloneCellStyles(target.styles);
  document.autoFilter = cloneAutoFilterState(target.autoFilter);
  document.tables = cloneTables(target.tables);
  return document;
}

function addWorksheet(document, requestedName) {
  if (Array.isArray(document?.worksheets) && document.worksheets.length >= MAX_WORKSHEETS) {
    throw new RangeError(`A workbook cannot contain more than ${MAX_WORKSHEETS} worksheets.`);
  }
  syncActiveWorksheet(document);
  const usedNames = new Set(document.worksheets.map(sheet => sheet.name.toLocaleLowerCase()));
  const usedIds = new Set(document.worksheets.map(sheet => sheet.id));
  const suggested = requestedName || `Sheet${document.worksheets.length + 1}`;
  const name = makeUniqueName(suggested, usedNames);
  let number = 1;
  while (usedIds.has(`sheet-${number}`)) number += 1;
  const worksheet = { id: `sheet-${number}`, name, cells: createEmptyGrid(), styles: {}, autoFilter: cloneAutoFilterState(null), tables: [] };
  document.worksheets.push(worksheet);
  document.activeWorksheetId = worksheet.id;
  document.cells = cloneGrid(worksheet.cells);
  document.styles = {};
  document.autoFilter = cloneAutoFilterState(null);
  document.tables = [];
  return document;
}

function renameWorksheet(document, worksheetId, requestedName) {
  const target = document?.worksheets?.find(sheet => sheet.id === worksheetId);
  if (!target) throw new Error('The selected worksheet could not be found.');
  const name = String(requestedName ?? '').trim();
  if (!name) throw new Error('A worksheet name is required.');
  if (name.length > 31) throw new Error('Worksheet names can be no longer than 31 characters.');
  if (/[\\/?*:[\]]/.test(name)) throw new Error('Worksheet names cannot contain: \\ / ? * [ or ].');
  const duplicate = document.worksheets.some(sheet => sheet.id !== worksheetId && sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (duplicate) throw new Error('A worksheet with that name already exists.');
  target.name = name;
  return document;
}

function deleteWorksheet(document, worksheetId) {
  if (!document || !Array.isArray(document.worksheets)) throw new Error('The workbook has no worksheets.');
  if (document.worksheets.length === 1) throw new Error('A workbook must contain at least one worksheet.');
  syncActiveWorksheet(document);
  const index = document.worksheets.findIndex(sheet => sheet.id === worksheetId);
  if (index < 0) throw new Error('The selected worksheet could not be found.');
  const wasActive = document.worksheets[index].id === document.activeWorksheetId;
  document.worksheets.splice(index, 1);
  if (wasActive) {
    const next = document.worksheets[Math.min(index, document.worksheets.length - 1)];
    document.activeWorksheetId = next.id;
    document.cells = cloneGrid(next.cells);
    document.styles = cloneCellStyles(next.styles);
    document.autoFilter = cloneAutoFilterState(next.autoFilter);
    document.tables = cloneTables(next.tables);
  }
  return document;
}

function moveWorksheet(document, worksheetId, targetIndex) {
  if (!Array.isArray(document?.worksheets)) throw new Error('The workbook has no worksheets.');
  const currentIndex = document.worksheets.findIndex(sheet => sheet.id === worksheetId);
  if (currentIndex < 0) throw new Error('The selected worksheet could not be found.');
  if (!Number.isInteger(targetIndex)) throw new TypeError('The worksheet position must be a whole number.');
  const [worksheet] = document.worksheets.splice(currentIndex, 1);
  const index = Math.max(0, Math.min(targetIndex, document.worksheets.length));
  document.worksheets.splice(index, 0, worksheet);
  return document;
}

return {
  DEFAULT_ROW_COUNT,
  DEFAULT_COLUMN_COUNT,
  MAX_WORKSHEETS,
  createEmptyGrid,
  cloneCellStyles,
  cloneAutoFilterState,
  cloneTables,
  normalizeWorkbook,
  syncActiveWorksheet,
  activateWorksheet,
  addWorksheet,
  renameWorksheet,
  deleteWorksheet,
  moveWorksheet
};
});
