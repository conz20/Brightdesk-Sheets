(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskWorkbookModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
'use strict';

const DEFAULT_ROW_COUNT = 20;
const DEFAULT_COLUMN_COUNT = 12;

function cloneGrid(cells, fallback = createEmptyGrid()) {
  if (!Array.isArray(cells)) return cloneGrid(fallback, createEmptyGrid());
  return cells.map(row => Array.isArray(row) ? row.map(value => value ?? '') : []);
}

function createEmptyGrid(rows = DEFAULT_ROW_COUNT, columns = DEFAULT_COLUMN_COUNT) {
  return Array.from({ length: rows }, () => Array(columns).fill(''));
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
    return { id, name, cells: cloneGrid(sheet?.cells, fallbackCells) };
  });

  const requestedActiveId = typeof source.activeWorksheetId === 'string' ? source.activeWorksheetId : '';
  const active = normalized.worksheets.find(sheet => sheet.id === requestedActiveId) || normalized.worksheets[0];
  normalized.activeWorksheetId = active.id;
  // Keep the legacy `cells` property as the active-sheet view for older readers.
  normalized.cells = cloneGrid(active.cells, fallbackCells);
  return normalized;
}

function syncActiveWorksheet(document) {
  if (!document || !Array.isArray(document.worksheets) || !document.worksheets.length) {
    throw new Error('The workbook has no worksheets to update.');
  }
  const active = document.worksheets.find(sheet => sheet.id === document.activeWorksheetId);
  if (!active) throw new Error('The active worksheet could not be found.');
  active.cells = cloneGrid(document.cells);
  return document;
}

function activateWorksheet(document, worksheetId) {
  syncActiveWorksheet(document);
  const target = document.worksheets.find(sheet => sheet.id === worksheetId);
  if (!target) throw new Error('The selected worksheet could not be found.');
  document.activeWorksheetId = target.id;
  document.cells = cloneGrid(target.cells);
  return document;
}

function addWorksheet(document, requestedName) {
  syncActiveWorksheet(document);
  const usedNames = new Set(document.worksheets.map(sheet => sheet.name.toLocaleLowerCase()));
  const usedIds = new Set(document.worksheets.map(sheet => sheet.id));
  const suggested = requestedName || `Sheet${document.worksheets.length + 1}`;
  const name = makeUniqueName(suggested, usedNames);
  let number = 1;
  while (usedIds.has(`sheet-${number}`)) number += 1;
  const worksheet = { id: `sheet-${number}`, name, cells: createEmptyGrid() };
  document.worksheets.push(worksheet);
  document.activeWorksheetId = worksheet.id;
  document.cells = cloneGrid(worksheet.cells);
  return document;
}

function renameWorksheet(document, worksheetId, requestedName) {
  const target = document?.worksheets?.find(sheet => sheet.id === worksheetId);
  if (!target) throw new Error('The selected worksheet could not be found.');
  const name = String(requestedName ?? '').trim();
  if (!name) throw new Error('A worksheet name is required.');
  if (name.length > 31) throw new Error('Worksheet names can be no longer than 31 characters.');
  if (/[\\/?*:[\\]]/.test(name)) throw new Error('Worksheet names cannot contain: \\ / ? * [ or ].');
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
  createEmptyGrid,
  normalizeWorkbook,
  syncActiveWorksheet,
  activateWorksheet,
  addWorksheet,
  renameWorksheet,
  deleteWorksheet,
  moveWorksheet
};
});
