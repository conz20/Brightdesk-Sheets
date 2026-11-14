const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const appCatalog = require('./app-catalog');
const { applyTableStyles } = require('./sheet-tables');

const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_SHEET_CELLS = 250_000;
const MAX_WORKSHEETS = 256;
const MAX_SLIDES = 2_000;
const KNOWN_APP_IDS = new Set(appCatalog.map(app => app.id));
const EXCLUDED_APP_IDS = new Set(['teams', 'outlook', 'onedrive']);

/*
 * Load format-specific libraries only when the corresponding format is used.
 * This keeps lightweight project/CSV operations and unit tests usable before
 * the full desktop dependency set has been installed. Every package remains
 * declared in package.json for normal application installs and release builds.
 */

function decodeUtf8(buffer, errorMessage) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    throw new Error(errorMessage);
  }
}

function assertDocumentTextLimit(byteLength) {
  if (byteLength > MAX_DOCUMENT_TEXT_BYTES) {
    throw new Error('The imported document exceeds the 10 MB text limit.');
  }
}

function assertSheetDimensions(rowCount, columnCount) {
  if (!Number.isSafeInteger(rowCount) || !Number.isSafeInteger(columnCount) || rowCount < 0 || columnCount < 0) {
    throw new Error('The imported spreadsheet has invalid worksheet dimensions.');
  }
  const boundedRows = Math.max(1, rowCount);
  const boundedColumns = Math.max(1, columnCount);
  if (boundedRows > Math.floor(MAX_SHEET_CELLS / boundedColumns)) {
    throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
  }
}

function assertSheetCellLimit(rows) {
  if (!Array.isArray(rows)) throw new Error('The imported spreadsheet has an invalid cell grid.');
  let cellCount = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) throw new Error('The imported spreadsheet contains an invalid row.');
    cellCount += row.length;
    if (cellCount > MAX_SHEET_CELLS) {
      throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
    }
  }
}
function assertWorksheetName(value, usedNames) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 31 || /[\\/?*:[\]]/.test(name)) {
    throw new Error('The workbook contains an invalid worksheet name.');
  }
  const key = name.toLocaleLowerCase();
  if (usedNames.has(key)) throw new Error('The workbook contains a duplicate worksheet name.');
  usedNames.add(key);
  return name;
}

function assertCellStyles(styles) {
  if (styles === undefined) return {};
  if (!isPlainObject(styles) || Object.keys(styles).length > MAX_SHEET_CELLS) {
    throw new Error('The Brightdesk Sheets workbook contains invalid cell formatting.');
  }
  const supportedFormats = new Set(['general', 'number', 'currency', 'percent', 'date']);
  const allowedProperties = new Set(['bold', 'italic', 'underline', 'fill', 'color', 'numberFormat']);
  for (const [address, style] of Object.entries(styles)) {
    if (!/^[A-Z]{1,3}[1-9]\d*$/i.test(address)) {
      throw new Error('The Brightdesk Sheets workbook contains an invalid cell address in its formatting.');
    }
    if (!isPlainObject(style) || Object.keys(style).some(key => !allowedProperties.has(key))) {
      throw new Error('The Brightdesk Sheets workbook contains invalid cell formatting.');
    }
    for (const key of ['bold', 'italic', 'underline']) {
      if (style[key] !== undefined && typeof style[key] !== 'boolean') {
        throw new Error('The Brightdesk Sheets workbook contains invalid cell formatting.');
      }
    }
    for (const key of ['fill', 'color']) {
      if (style[key] !== undefined && style[key] !== null &&
          (typeof style[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(style[key]))) {
        throw new Error('The Brightdesk Sheets workbook contains invalid cell formatting.');
      }
    }
    if (style.numberFormat !== undefined && !supportedFormats.has(style.numberFormat)) {
      throw new Error('The Brightdesk Sheets workbook contains invalid cell formatting.');
    }
  }
  return styles;
}

function hasExcelAutoFilterRange(value) {
  if (typeof value === 'string') {
    return /^\$?[A-Z]{1,3}\$?[1-9]\d*:\$?[A-Z]{1,3}\$?[1-9]\d*$/i.test(value);
  }
  if (!isPlainObject(value) || value.from == null || value.to == null) return false;
  const isAddress = item => typeof item === 'string'
    ? /^\$?[A-Z]{1,3}\$?[1-9]\d*$/i.test(item)
    : isPlainObject(item) && Number.isInteger(item.row) && Number.isInteger(item.column) &&
      item.row > 0 && item.column > 0;
  return isAddress(value.from) && isAddress(value.to);
}

function assertAutoFilterState(value) {
  if (value === undefined) return {};
  if (!isPlainObject(value) || typeof value.enabled !== 'boolean' ||
      !isPlainObject(value.filters)) {
    throw new Error('The Brightdesk Sheets workbook contains invalid worksheet filter settings.');
  }
  let totalValues = 0;
  for (const [column, values] of Object.entries(value.filters)) {
    if (!/^(?:0|[1-9]\d*)$/.test(column) || !Number.isSafeInteger(Number(column)) ||
        Number(column) >= 16_384 || !Array.isArray(values)) {
      throw new Error('The Brightdesk Sheets workbook contains invalid worksheet filter settings.');
    }
    for (const entry of values) {
      if (typeof entry !== 'string' || entry.length > 32_767 || ++totalValues > 250_000) {
        throw new Error('The Brightdesk Sheets workbook contains invalid worksheet filter settings.');
      }
    }
  }
  return value;
}

function assertTableCollection(tables, rows, options = {}) {
  if (tables === undefined) return [];
  if (!Array.isArray(tables) || tables.length > 1000) {
    throw new Error('The Brightdesk Sheets workbook contains an invalid table collection.');
  }
  const names = options.names || new Set();
  const ids = options.ids || new Set();
  const ranges = [];
  for (const table of tables) {
    if (!isPlainObject(table) || typeof table.id !== 'string' || !table.id.trim() ||
        table.id.length > 128 || typeof table.name !== 'string' ||
        !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(table.name) ||
        /^[A-Z]{1,3}[1-9]\d*$/i.test(table.name) || table.name.length > 255) {
      throw new Error('The Brightdesk Sheets workbook contains an invalid table name or ID.');
    }
    const nameKey = table.name.toLocaleLowerCase();
    if (names.has(nameKey) || ids.has(table.id)) {
      throw new Error('The Brightdesk Sheets workbook contains a duplicate table name or ID.');
    }
    names.add(nameKey);
    ids.add(table.id);
    const range = table.range;
    if (!isPlainObject(range) || !Number.isInteger(range.top) || !Number.isInteger(range.left) ||
        !Number.isInteger(range.bottom) || !Number.isInteger(range.right) ||
        range.top < 0 || range.left < 0 || range.bottom < range.top || range.right < range.left ||
        range.bottom >= 1_048_576 || range.right >= 16_384) {
      throw new Error('The Brightdesk Sheets workbook contains an invalid table range.');
    }
    const rowCount = range.bottom - range.top + 1;
    const columnCount = range.right - range.left + 1;
    if (rowCount > Math.floor(MAX_SHEET_CELLS / columnCount)) {
      throw new Error('The Brightdesk Sheets workbook table exceeds the 250,000-cell limit.');
    }
    if (!Array.isArray(rows) || range.bottom >= rows.length ||
        rows.slice(range.top, range.bottom + 1).some(row => !Array.isArray(row) || row.length <= range.right)) {
      throw new Error('The Brightdesk Sheets table range must be inside the worksheet.');
    }
    if (!Array.isArray(table.columns) || table.columns.length !== columnCount ||
        table.columns.some(column => typeof column !== 'string' || !column.trim() || column.length > 255)) {
      throw new Error('The Brightdesk Sheets workbook contains invalid table columns.');
    }
    const columnNames = new Set();
    for (let index = 0; index < table.columns.length; index += 1) {
      const column = table.columns[index];
      const key = column.toLocaleLowerCase();
      if (columnNames.has(key)) throw new Error('The Brightdesk Sheets workbook contains duplicate table column names.');
      columnNames.add(key);
      const savedHeader = rows[range.top][range.left + index];
      if (String(savedHeader ?? '').trim() !== column) {
        throw new Error('The Brightdesk Sheets table columns must match their worksheet header cells.');
      }
    }
    if (table.headerRow !== undefined && table.headerRow !== true) {
      throw new Error('The Brightdesk Sheets workbook contains an invalid table header setting.');
    }
    if (table.totalsRow !== undefined && typeof table.totalsRow !== 'boolean') {
      throw new Error('The Brightdesk Sheets workbook contains an invalid table totals-row setting.');
    }
    if (table.style !== undefined && table.style !== 'brightdesk-green') {
      throw new Error('The Brightdesk Sheets workbook contains an invalid table style.');
    }
    for (const other of ranges) {
      const overlaps = range.top <= other.bottom && range.bottom >= other.top &&
        range.left <= other.right && range.right >= other.left;
      if (overlaps) throw new Error('Brightdesk table ranges cannot overlap on the same worksheet.');
    }
    ranges.push(range);
  }
  return tables;
}


function excelColumnNumber(label) {
  let result = 0;
  for (const character of String(label).toUpperCase()) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result;
}

function parseExcelCellAddress(value) {
  const match = String(value || '').match(/^\$?([A-Z]{1,3})\$?([1-9]\d*)$/i);
  if (!match) return null;
  return { row: Number(match[2]) - 1, column: excelColumnNumber(match[1]) - 1 };
}

function parseExcelRangeAddress(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(':');
  if (parts.length !== 2) return null;
  const start = parseExcelCellAddress(parts[0]);
  const end = parseExcelCellAddress(parts[1]);
  if (!start || !end || end.row < start.row || end.column < start.column) return null;
  return { top: start.row, left: start.column, bottom: end.row, right: end.column };
}

function columnLabel(number) {
  let value = number;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function excelColorToHex(colour) {
  const raw = String(colour?.argb || colour?.rgb || '').replace(/^#/, '');
  const hex = raw.length === 8 ? raw.slice(-6) : raw;
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function readExcelCellStyle(cell) {
  const style = {
    bold: cell.font?.bold === true,
    italic: cell.font?.italic === true,
    underline: cell.font?.underline === true,
    fill: cell.fill?.type === 'pattern' && cell.fill.pattern === 'solid'
      ? excelColorToHex(cell.fill.fgColor)
      : null,
    color: excelColorToHex(cell.font?.color),
    numberFormat: 'general'
  };
  const format = String(cell.numFmt || '').toLowerCase();
  if (format.includes('%')) style.numberFormat = 'percent';
  else if (format.includes('
  if (slideCount > MAX_SLIDES) {
    throw new Error('The imported presentation exceeds the 2,000-slide limit.');
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateProject(project) {
  if (!isPlainObject(project)) throw new Error('This Brightdesk project is not a valid project object.');
  if (project.docs !== undefined && !isPlainObject(project.docs)) throw new Error('This Brightdesk project has an invalid document collection.');
  const docs = project.docs || {};
  for (const [appId, doc] of Object.entries(docs)) {
    if (EXCLUDED_APP_IDS.has(appId) || !KNOWN_APP_IDS.has(appId)) throw new Error(`This project contains an unsupported app module: ${appId}.`);
    if (!isPlainObject(doc)) throw new Error(`The ${appId} document is not valid.`);
    if (doc.title !== undefined && (typeof doc.title !== 'string' || Buffer.byteLength(doc.title, 'utf8') > 1000)) {
      throw new Error(`The ${appId} document has an invalid title.`);
    }
    if (appId === 'pages' && doc.html !== undefined && (typeof doc.html !== 'string' || Buffer.byteLength(doc.html, 'utf8') > MAX_DOCUMENT_TEXT_BYTES)) {
      throw new Error('The Brightdesk Pages document content is invalid or exceeds the 10 MB limit.');
    }
    if (appId === 'notes' && doc.text !== undefined && (typeof doc.text !== 'string' || Buffer.byteLength(doc.text, 'utf8') > MAX_DOCUMENT_TEXT_BYTES)) {
      throw new Error('The Brightdesk Notes content is invalid or exceeds the 10 MB limit.');
    }
    if (appId === 'sheets') {
      const validateProjectGrid = rows => {
        if (!Array.isArray(rows)) throw new Error('The Brightdesk Sheets workbook has an invalid cell grid.');
        let count = 0;
        for (const row of rows) {
          if (!Array.isArray(row)) throw new Error('The Brightdesk Sheets workbook contains an invalid row.');
          count += row.length;
          if (count > MAX_SHEET_CELLS) throw new Error('The Brightdesk Sheets workbook exceeds the 250,000-cell project limit.');
          if (row.some(cell => cell !== null && !['string', 'number', 'boolean'].includes(typeof cell))) {
            throw new Error('The Brightdesk Sheets workbook contains an unsupported cell value.');
          }
        }
        return count;
      };
      if (doc.cells !== undefined) validateProjectGrid(doc.cells);
      if (doc.styles !== undefined) assertCellStyles(doc.styles);
      if (doc.autoFilter !== undefined) assertAutoFilterState(doc.autoFilter);
      if (doc.tables !== undefined) assertTableCollection(doc.tables, doc.cells || []);
      if (doc.worksheets !== undefined) {
        if (!Array.isArray(doc.worksheets) || doc.worksheets.length < 1 || doc.worksheets.length > MAX_WORKSHEETS) {
          throw new Error('The Brightdesk Sheets workbook has an invalid worksheet collection.');
        }
        const worksheetIds = new Set();
        const worksheetNames = new Set();
        const workbookTableNames = new Set();
        const workbookTableIds = new Set();
        let workbookCellCount = 0;
        for (const worksheet of doc.worksheets) {
          if (!isPlainObject(worksheet) || typeof worksheet.id !== 'string' || !worksheet.id.trim()) {
            throw new Error('The Brightdesk Sheets workbook contains an invalid worksheet.');
          }
          if (worksheetIds.has(worksheet.id)) throw new Error('The Brightdesk Sheets workbook contains a duplicate worksheet ID.');
          worksheetIds.add(worksheet.id);
          assertWorksheetName(worksheet.name, worksheetNames);
          workbookCellCount += validateProjectGrid(worksheet.cells);
          assertCellStyles(worksheet.styles);
          if (worksheet.autoFilter !== undefined) assertAutoFilterState(worksheet.autoFilter);
          if (worksheet.tables !== undefined) assertTableCollection(worksheet.tables, worksheet.cells, { names: workbookTableNames, ids: workbookTableIds });
          if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The Brightdesk Sheets workbook exceeds the 250,000-cell project limit.');
        }
        if (doc.activeWorksheetId !== undefined &&
            (typeof doc.activeWorksheetId !== 'string' || !worksheetIds.has(doc.activeWorksheetId))) {
          throw new Error('The Brightdesk Sheets workbook refers to an unknown active worksheet.');
        }
      }
    }
    if (appId === 'slides' && doc.slides !== undefined) {
      if (!Array.isArray(doc.slides) || doc.slides.length > MAX_SLIDES) throw new Error('The Brightdesk Decks presentation has an invalid slide collection.');
      for (const slide of doc.slides) {
        if (!isPlainObject(slide) || (slide.title !== undefined && typeof slide.title !== 'string') || (slide.body !== undefined && typeof slide.body !== 'string')) {
          throw new Error('The Brightdesk Decks presentation contains an invalid slide.');
        }
      }
      if (doc.current !== undefined && (!Number.isInteger(doc.current) || doc.current < 0 || (doc.slides.length && doc.current >= doc.slides.length))) {
        throw new Error('The Brightdesk Decks presentation has an invalid selected slide.');
      }
    }
  }
  let serialized;
  try { serialized = JSON.stringify(project); } catch { throw new Error('This Brightdesk project cannot be saved as JSON.'); }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PROJECT_BYTES) throw new Error('This Brightdesk project exceeds the 50 MB size limit.');
  return project;
}

function cleanFileName(value) {
  return String(value || 'Brightdesk file').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 120) || 'Brightdesk file';
}
function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], cell = '', quoted = false, quoteClosed = false, fieldStarted = false, cellCount = 0;
  const pushCell = () => {
    cellCount++;
    if (cellCount > MAX_SHEET_CELLS) {
      throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
    }
    row.push(cell);
    cell = '';
    quoteClosed = false;
    fieldStarted = false;
  };
  const rejectMalformedQuotes = () => {
    throw new Error('This delimited file contains invalid quotation marks.');
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isNewline = ch === '\n' || ch === '\r';

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; quoteClosed = true; }
      } else cell += ch;
      continue;
    }

    if (quoteClosed) {
      if (ch === delimiter) { pushCell(); continue; }
      if (isNewline) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        pushCell();
        rows.push(row);
        row = [];
        continue;
      }
      rejectMalformedQuotes();
    }

    if (ch === '"') {
      if (fieldStarted) rejectMalformedQuotes();
      quoted = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      pushCell();
    } else if (isNewline) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushCell();
      rows.push(row);
      row = [];
    } else {
      cell += ch;
      fieldStarted = true;
    }
  }

  if (quoted) rejectMalformedQuotes();
  if (fieldStarted || row.length) {
    pushCell();
    rows.push(row);
  }
  return rows;
}
function parseCsv(text) { return parseDelimited(text, ','); }
function parseTsv(text) { return parseDelimited(text, '\t'); }
function ensureExtension(filePath, defaultExtension) {
  const extension = String(defaultExtension || '').replace(/^\./, '');
  if (!extension) return filePath;
  const currentExtension = path.extname(filePath);
  if (currentExtension && currentExtension !== '.') return filePath;
  const basePath = currentExtension === '.' ? filePath.slice(0, -1) : filePath;
  return `${basePath}.${extension}`;
}

function collectXmlText(value, output = []) {
  if (Array.isArray(value)) value.forEach(item => collectXmlText(item, output));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'a:t' || key === 't') {
        if (Array.isArray(child)) child.forEach(v => output.push(String(v)));
        else if (child !== undefined && typeof child !== 'object') output.push(String(child));
      } else collectXmlText(child, output);
    }
  }
  return output;
}
async function openOfficeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = await fs.stat(filePath);
  if (stat.size > 50 * 1024 * 1024) throw new Error('This file is over the 50 MB import limit.');
  const buffer = await fs.readFile(filePath);
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    assertDocumentTextLimit(Buffer.byteLength(result.value, 'utf8'));
    return { kind: 'pages', title: path.basename(filePath, ext), html: result.value, warnings: result.messages.map(m => m.message) };
  }
  if (ext === '.xlsx' || ext === '.xlsm') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    if (workbook.worksheets.length > MAX_WORKSHEETS) throw new Error('The imported workbook exceeds the 256-worksheet limit.');
    const usedNames = new Set();
    const worksheets = [];
    let workbookCellCount = 0;
    workbook.worksheets.forEach((sheet, index) => {
      assertSheetDimensions(sheet.rowCount, sheet.columnCount);
      const name = assertWorksheetName(sheet.name || `Sheet${index + 1}`, usedNames);
      const rows = [];
      const styles = {};
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        rows[rowNumber - 1] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const value = cell.value?.result ?? cell.value ?? '';
          rows[rowNumber - 1][colNumber - 1] = cell.formula ? `=${cell.formula}` : (value instanceof Date ? value.toISOString().slice(0, 10) : value);
          const style = readExcelCellStyle(cell);
          if (style) styles[`${columnLabel(colNumber)}${rowNumber}`] = style;
        });
      });
      assertSheetCellLimit(rows);
      workbookCellCount += rows.reduce((count, row) => count + row.length, 0);
      if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
      const importedWorksheet = {
        id: `sheet-${index + 1}`, name, cells: rows, styles,
        autoFilter: hasExcelAutoFilterRange(sheet.autoFilter)
          ? { enabled: true, filters: {} }
          : { enabled: false, filters: {} },
        tables: []
      };
      for (const excelTable of sheet.getTables()) {
        const model = excelTable.model;
        const range = parseExcelRangeAddress(model.tableRef || model.autoFilterRef);
        const columns = Array.isArray(model.columns) ? model.columns.map(column => column.name) : [];
        if (!range || model.headerRow === false || model.totalsRow === true ||
            typeof model.name !== 'string' || !columns.length ||
            range.bottom >= rows.length || range.right - range.left + 1 !== columns.length) {
          continue;
        }
        const importedTable = {
          id: `table-${workbookCellCount}-${importedWorksheet.tables.length + 1}`,
          name: model.name,
          range,
          columns,
          headerRow: true,
          totalsRow: false,
          style: 'brightdesk-green'
        };
        importedWorksheet.tables.push(importedTable);
        importedWorksheet.styles = applyTableStyles(importedWorksheet.styles, importedTable);
      }
      worksheets.push(importedWorksheet);
    });
    if (!worksheets.length) return { kind: 'sheets', title: path.basename(filePath, ext), cells: [[]] };
    const requestedActiveTab = Number(workbook.views?.[0]?.activeTab);
    const activeIndex = Number.isInteger(requestedActiveTab) && requestedActiveTab >= 0 && requestedActiveTab < worksheets.length
      ? requestedActiveTab
      : 0;
    const activeWorksheet = worksheets[activeIndex];
    return {
      kind: 'sheets',
      title: path.basename(filePath, ext),
      cells: activeWorksheet.cells,
      styles: activeWorksheet.styles,
      autoFilter: activeWorksheet.autoFilter,
      tables: activeWorksheet.tables,
      worksheets,
      activeWorksheetId: activeWorksheet.id
    };
  }
  if (ext === '.csv' || ext === '.tsv') {
    const text = decodeUtf8(buffer, 'This imported file is not valid UTF-8 text.').replace(/^\uFEFF/, '');
    const rows = ext === '.tsv' ? parseTsv(text) : parseCsv(text);
    assertSheetCellLimit(rows);
    return { kind: 'sheets', title: path.basename(filePath, ext), cells: rows };
  }
  if (ext === '.pptx') {
    const JSZip = require('jszip');
    const { XMLParser } = require('fast-xml-parser');
    const zip = await JSZip.loadAsync(buffer);
    const slideEntries = Object.values(zip.files).filter(entry => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name));
    const totalSlideBytes = slideEntries.reduce((total, entry) => total + (entry._data?.uncompressedSize || 0), 0);
    if (totalSlideBytes > 50 * 1024 * 1024) throw new Error('The presentation contains too much uncompressed slide XML to import safely.');
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    assertPresentationSlideLimit(names.length);
    const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: false });
    const slides = [];
    for (const name of names) {
      const xml = await zip.files[name].async('string');
      const texts = collectXmlText(parser.parse(xml)).filter(Boolean);
      slides.push({ title: texts[0] || `Slide ${slides.length + 1}`, body: texts.slice(1).join('\n') });
    }
    return { kind: 'slides', title: path.basename(filePath, ext), slides: slides.length ? slides : [{ title: 'Imported presentation', body: '' }] };
  }
  if (ext === '.txt' || ext === '.md' || ext === '.html') {
    assertDocumentTextLimit(buffer.byteLength);
    const text = decodeUtf8(buffer, 'This imported file is not valid UTF-8 text.');
    return { kind: ext === '.txt' ? 'notes' : 'pages', title: path.basename(filePath, ext), text, html: ext === '.html' ? text : undefined };
  }
  if (ext === '.bdesk') {
    const jsonText = decodeUtf8(buffer, 'This Brightdesk project file is not valid UTF-8 JSON.');
    let project;
    try { project = JSON.parse(jsonText); }
    catch { throw new Error('This Brightdesk project file is not valid JSON.'); }
    return validateProject(project);
  }
  throw new Error(`Brightdesk cannot open ${ext || 'this file type'} yet. Supported: DOCX, XLSX, CSV, PPTX, TXT, MD, HTML and BDESK.`);
}
function htmlToBlocks(html) {
  const stripped = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n');
  const noTags = stripped.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return noTags.split(/\n+/).map(text => text.trim()).filter(Boolean);
}
function toExcelCellValue(value) {
  if (value === '' || value == null) return null;
  if (typeof value !== 'string') return value;
  if (value.startsWith('=')) return { formula: value.slice(1) };

  const trimmed = value.trim();
  if (!trimmed) return value;

  // Keep identifiers and high-precision numbers as text rather than silently
  // stripping leading zeroes or rounding them to Excel's 15-digit precision.
  if (/^[+-]?0\\d/.test(trimmed)) return value;
  const significantDigits = trimmed.replace(/[^0-9]/g, '').replace(/^0+/, '').length;
  if (significantDigits > 15) return value;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

async function exportOfficeFile(payload, filePath) {
  const kind = payload.kind;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.bdesk') {
    const project = validateProject(payload.project);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2));
    return;
  }
  if (kind === 'pages' && ext === '.docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
    const blocks = payload.blocks?.length ? payload.blocks : htmlToBlocks(payload.html).map(text => ({ text, type: 'paragraph' }));
    const children = blocks.map(block => new Paragraph({
      heading: block.type === 'h1' ? HeadingLevel.HEADING_1 : block.type === 'h2' ? HeadingLevel.HEADING_2 : undefined,
      bullet: block.type === 'li' ? { indent: 360 } : undefined,
      children: [new TextRun({ text: block.text || '', bold: !!block.bold, italics: !!block.italic, underline: block.underline ? {} : undefined })]
    }));
    const doc = new Document({ sections: [{ children }] });
    await fs.writeFile(filePath, await Packer.toBuffer(doc)); return;
  }
  if (kind === 'sheets' && (ext === '.xlsx' || ext === '.xlsm')) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sourceSheets = Array.isArray(payload.worksheets) && payload.worksheets.length
      ? payload.worksheets
      : [{ name: payload.title || 'Sheet1', cells: payload.rows || [] }];
    if (sourceSheets.length > MAX_WORKSHEETS) throw new Error('The workbook exceeds the 256-worksheet limit.');
    const usedNames = new Set();
    let workbookCellCount = 0;
    let activeTab = 0;
    const workbookTableNames = new Set();
    const workbookTableIds = new Set();
    if (payload.activeWorksheetId) {
      const foundIndex = sourceSheets.findIndex(source => source?.id === payload.activeWorksheetId);
      if (foundIndex >= 0) activeTab = foundIndex;
    }
    sourceSheets.forEach((source, index) => {
      const name = assertWorksheetName(source?.name || (index === 0 ? payload.title || 'Sheet1' : `Sheet${index + 1}`), usedNames);
      const rows = source?.cells || (index === 0 ? payload.rows || [] : []);
      assertSheetCellLimit(rows);
      workbookCellCount += rows.reduce((count, row) => count + row.length, 0);
      if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The workbook exceeds the 250,000-cell limit.');
      const sheet = workbook.addWorksheet(name);
      rows.forEach((row, r) => row.forEach((value, c) => {
        const cell = sheet.getCell(r + 1, c + 1);
        cell.value = toExcelCellValue(value);
        const address = `${columnLabel(c + 1)}${r + 1}`;
        applyExcelCellStyle(cell, source.styles?.[address] || (index === activeTab ? payload.styles?.[address] : null));
      }));
      const worksheetTables = assertTableCollection(
        source.tables ?? (index === activeTab ? payload.tables : undefined),
        rows,
        { names: workbookTableNames, ids: workbookTableIds }
      );
      let exportedTableCount = 0;
      for (const table of worksheetTables) {
        if (table.headerRow === false || table.totalsRow === true) continue;
        const tableRows = [];
        for (let row = table.range.top + 1; row <= table.range.bottom; row += 1) {
          tableRows.push(rows[row].slice(table.range.left, table.range.right + 1).map(toExcelCellValue));
        }
        sheet.addTable({
          name: table.name,
          ref: `${columnLabel(table.range.left + 1)}${table.range.top + 1}`,
          headerRow: true,
          totalsRow: false,
          style: { theme: 'TableStyleMedium4', showRowStripes: true },
          columns: table.columns.map(name => ({ name, filterButton: true })),
          rows: tableRows
        });
        exportedTableCount += 1;
      }

      const filterState = assertAutoFilterState(source.autoFilter ?? (index === activeTab ? payload.autoFilter : undefined));
      const filterColumnCount = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
      if (filterState.enabled && rows.length > 0 && filterColumnCount > 0 && exportedTableCount === 0) {
        sheet.autoFilter = `A1:${columnLabel(filterColumnCount)}${rows.length}`;
      }
      sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
      sheet.columns.forEach(col => { col.width = 16; });
    });
    workbook.views = [{ activeTab, firstSheet: 0, visibility: 'visible' }];
    await workbook.xlsx.writeFile(filePath); return;
  }
  if (kind === 'sheets' && ext === '.csv') {
    const csv = (payload.rows || []).map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    await fs.writeFile(filePath, '\uFEFF' + csv, 'utf8'); return;
  }
  if (kind === 'slides' && ext === '.pptx') {
    const PptxGenJS = require('pptxgenjs');
    const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Brightdesk'; pptx.subject = 'Brightdesk presentation';
    for (const data of (payload.slides || [])) {
      const slide = pptx.addSlide(); slide.background = { color: 'F6F5FF' };
      slide.addText(data.title || '', { x: 0.8, y: 1.1, w: 11, h: 1.2, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: '38356F' });
      slide.addText(data.body || '', { x: 0.85, y: 2.65, w: 10.8, h: 3.7, fontFace: 'Aptos', fontSize: 20, color: '55566B', breakLine: false, valign: 'top' });
    }
    await pptx.writeFile({ fileName: filePath }); return;
  }
  if (kind === 'pages' && ext === '.html') { await fs.writeFile(filePath, payload.html || '', 'utf8'); return; }
  if (kind === 'notes' && (ext === '.md' || ext === '.txt')) { await fs.writeFile(filePath, payload.text || '', 'utf8'); return; }
  throw new Error(`This export format is not available for ${kind}.`);
}
module.exports = { cleanFileName, parseCsv, parseTsv, ensureExtension, openOfficeFile, exportOfficeFile, validateProject, assertSheetDimensions };
)) style.numberFormat = 'currency';
  else if (/d{1,2}[^a-z]*m{1,4}[^a-z]*y{2,4}/i.test(format) || /y{2,4}[^a-z]*m{1,4}[^a-z]*d{1,2}/i.test(format)) style.numberFormat = 'date';
  else if (format.includes('0') || format.includes('#')) style.numberFormat = 'number';
  const compact = Object.fromEntries(Object.entries(style).filter(([key, value]) => {
    if (key === 'numberFormat') return value !== 'general';
    if (key === 'fill' || key === 'color') return value !== null;
    return value === true;
  }));
  return Object.keys(compact).length ? style : null;
}

function applyExcelCellStyle(cell, style) {
  if (!style || typeof style !== 'object') return;
  const font = {};
  if (style.bold) font.bold = true;
  if (style.italic) font.italic = true;
  if (style.underline) font.underline = true;
  if (style.color) font.color = { argb: `FF${style.color.slice(1)}` };
  if (Object.keys(font).length) cell.font = font;
  if (style.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${style.fill.slice(1)}` } };
  const formats = {
    general: 'General',
    number: '#,##0.00',
    currency: '$#,##0.00',
    percent: '0.00%',
    date: 'dd/mm/yyyy'
  };
  if (style.numberFormat === 'date' && typeof cell.value === 'string') {
    const match = cell.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const date = new Date(cell.value + 'T00:00:00.000Z');
      if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === cell.value) cell.value = date;
    }
  }
  if (style.numberFormat && formats[style.numberFormat]) cell.numFmt = formats[style.numberFormat];
}

function assertPresentationSlideLimit(slideCount) {
  if (slideCount > MAX_SLIDES) {
    throw new Error('The imported presentation exceeds the 2,000-slide limit.');
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateProject(project) {
  if (!isPlainObject(project)) throw new Error('This Brightdesk project is not a valid project object.');
  if (project.docs !== undefined && !isPlainObject(project.docs)) throw new Error('This Brightdesk project has an invalid document collection.');
  const docs = project.docs || {};
  for (const [appId, doc] of Object.entries(docs)) {
    if (EXCLUDED_APP_IDS.has(appId) || !KNOWN_APP_IDS.has(appId)) throw new Error(`This project contains an unsupported app module: ${appId}.`);
    if (!isPlainObject(doc)) throw new Error(`The ${appId} document is not valid.`);
    if (doc.title !== undefined && (typeof doc.title !== 'string' || Buffer.byteLength(doc.title, 'utf8') > 1000)) {
      throw new Error(`The ${appId} document has an invalid title.`);
    }
    if (appId === 'pages' && doc.html !== undefined && (typeof doc.html !== 'string' || Buffer.byteLength(doc.html, 'utf8') > MAX_DOCUMENT_TEXT_BYTES)) {
      throw new Error('The Brightdesk Pages document content is invalid or exceeds the 10 MB limit.');
    }
    if (appId === 'notes' && doc.text !== undefined && (typeof doc.text !== 'string' || Buffer.byteLength(doc.text, 'utf8') > MAX_DOCUMENT_TEXT_BYTES)) {
      throw new Error('The Brightdesk Notes content is invalid or exceeds the 10 MB limit.');
    }
    if (appId === 'sheets') {
      const validateProjectGrid = rows => {
        if (!Array.isArray(rows)) throw new Error('The Brightdesk Sheets workbook has an invalid cell grid.');
        let count = 0;
        for (const row of rows) {
          if (!Array.isArray(row)) throw new Error('The Brightdesk Sheets workbook contains an invalid row.');
          count += row.length;
          if (count > MAX_SHEET_CELLS) throw new Error('The Brightdesk Sheets workbook exceeds the 250,000-cell project limit.');
          if (row.some(cell => cell !== null && !['string', 'number', 'boolean'].includes(typeof cell))) {
            throw new Error('The Brightdesk Sheets workbook contains an unsupported cell value.');
          }
        }
        return count;
      };
      if (doc.cells !== undefined) validateProjectGrid(doc.cells);
      if (doc.worksheets !== undefined) {
        if (!Array.isArray(doc.worksheets) || doc.worksheets.length < 1 || doc.worksheets.length > MAX_WORKSHEETS) {
          throw new Error('The Brightdesk Sheets workbook has an invalid worksheet collection.');
        }
        const worksheetIds = new Set();
        const worksheetNames = new Set();
        let workbookCellCount = 0;
        for (const worksheet of doc.worksheets) {
          if (!isPlainObject(worksheet) || typeof worksheet.id !== 'string' || !worksheet.id.trim()) {
            throw new Error('The Brightdesk Sheets workbook contains an invalid worksheet.');
          }
          if (worksheetIds.has(worksheet.id)) throw new Error('The Brightdesk Sheets workbook contains a duplicate worksheet ID.');
          worksheetIds.add(worksheet.id);
          assertWorksheetName(worksheet.name, worksheetNames);
          workbookCellCount += validateProjectGrid(worksheet.cells);
          if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The Brightdesk Sheets workbook exceeds the 250,000-cell project limit.');
        }
        if (doc.activeWorksheetId !== undefined &&
            (typeof doc.activeWorksheetId !== 'string' || !worksheetIds.has(doc.activeWorksheetId))) {
          throw new Error('The Brightdesk Sheets workbook refers to an unknown active worksheet.');
        }
      }
    }
    if (appId === 'slides' && doc.slides !== undefined) {
      if (!Array.isArray(doc.slides) || doc.slides.length > MAX_SLIDES) throw new Error('The Brightdesk Decks presentation has an invalid slide collection.');
      for (const slide of doc.slides) {
        if (!isPlainObject(slide) || (slide.title !== undefined && typeof slide.title !== 'string') || (slide.body !== undefined && typeof slide.body !== 'string')) {
          throw new Error('The Brightdesk Decks presentation contains an invalid slide.');
        }
      }
      if (doc.current !== undefined && (!Number.isInteger(doc.current) || doc.current < 0 || (doc.slides.length && doc.current >= doc.slides.length))) {
        throw new Error('The Brightdesk Decks presentation has an invalid selected slide.');
      }
    }
  }
  let serialized;
  try { serialized = JSON.stringify(project); } catch { throw new Error('This Brightdesk project cannot be saved as JSON.'); }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PROJECT_BYTES) throw new Error('This Brightdesk project exceeds the 50 MB size limit.');
  return project;
}

function cleanFileName(value) {
  return String(value || 'Brightdesk file').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 120) || 'Brightdesk file';
}
function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], cell = '', quoted = false, quoteClosed = false, fieldStarted = false, cellCount = 0;
  const pushCell = () => {
    cellCount++;
    if (cellCount > MAX_SHEET_CELLS) {
      throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
    }
    row.push(cell);
    cell = '';
    quoteClosed = false;
    fieldStarted = false;
  };
  const rejectMalformedQuotes = () => {
    throw new Error('This delimited file contains invalid quotation marks.');
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isNewline = ch === '\n' || ch === '\r';

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; quoteClosed = true; }
      } else cell += ch;
      continue;
    }

    if (quoteClosed) {
      if (ch === delimiter) { pushCell(); continue; }
      if (isNewline) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        pushCell();
        rows.push(row);
        row = [];
        continue;
      }
      rejectMalformedQuotes();
    }

    if (ch === '"') {
      if (fieldStarted) rejectMalformedQuotes();
      quoted = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      pushCell();
    } else if (isNewline) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushCell();
      rows.push(row);
      row = [];
    } else {
      cell += ch;
      fieldStarted = true;
    }
  }

  if (quoted) rejectMalformedQuotes();
  if (fieldStarted || row.length) {
    pushCell();
    rows.push(row);
  }
  return rows;
}
function parseCsv(text) { return parseDelimited(text, ','); }
function parseTsv(text) { return parseDelimited(text, '\t'); }
function ensureExtension(filePath, defaultExtension) {
  const extension = String(defaultExtension || '').replace(/^\./, '');
  if (!extension) return filePath;
  const currentExtension = path.extname(filePath);
  if (currentExtension && currentExtension !== '.') return filePath;
  const basePath = currentExtension === '.' ? filePath.slice(0, -1) : filePath;
  return `${basePath}.${extension}`;
}

function collectXmlText(value, output = []) {
  if (Array.isArray(value)) value.forEach(item => collectXmlText(item, output));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'a:t' || key === 't') {
        if (Array.isArray(child)) child.forEach(v => output.push(String(v)));
        else if (child !== undefined && typeof child !== 'object') output.push(String(child));
      } else collectXmlText(child, output);
    }
  }
  return output;
}
async function openOfficeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = await fs.stat(filePath);
  if (stat.size > 50 * 1024 * 1024) throw new Error('This file is over the 50 MB import limit.');
  const buffer = await fs.readFile(filePath);
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    assertDocumentTextLimit(Buffer.byteLength(result.value, 'utf8'));
    return { kind: 'pages', title: path.basename(filePath, ext), html: result.value, warnings: result.messages.map(m => m.message) };
  }
  if (ext === '.xlsx' || ext === '.xlsm') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    if (workbook.worksheets.length > MAX_WORKSHEETS) throw new Error('The imported workbook exceeds the 256-worksheet limit.');
    const usedNames = new Set();
    const worksheets = [];
    let workbookCellCount = 0;
    workbook.worksheets.forEach((sheet, index) => {
      assertSheetDimensions(sheet.rowCount, sheet.columnCount);
      const name = assertWorksheetName(sheet.name || `Sheet${index + 1}`, usedNames);
      const rows = [];
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        rows[rowNumber - 1] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rows[rowNumber - 1][colNumber - 1] = cell.formula ? `=${cell.formula}` : (cell.value?.result ?? cell.value ?? '');
        });
      });
      assertSheetCellLimit(rows);
      workbookCellCount += rows.reduce((count, row) => count + row.length, 0);
      if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The imported spreadsheet exceeds the 250,000-cell limit.');
      worksheets.push({ id: `sheet-${index + 1}`, name, cells: rows });
    });
    if (!worksheets.length) return { kind: 'sheets', title: path.basename(filePath, ext), cells: [[]] };
    const requestedActiveTab = Number(workbook.views?.[0]?.activeTab);
    const activeIndex = Number.isInteger(requestedActiveTab) && requestedActiveTab >= 0 && requestedActiveTab < worksheets.length
      ? requestedActiveTab
      : 0;
    const activeWorksheet = worksheets[activeIndex];
    return {
      kind: 'sheets',
      title: path.basename(filePath, ext),
      cells: activeWorksheet.cells,
      worksheets,
      activeWorksheetId: activeWorksheet.id
    };
  }
  if (ext === '.csv' || ext === '.tsv') {
    const text = decodeUtf8(buffer, 'This imported file is not valid UTF-8 text.').replace(/^\uFEFF/, '');
    const rows = ext === '.tsv' ? parseTsv(text) : parseCsv(text);
    assertSheetCellLimit(rows);
    return { kind: 'sheets', title: path.basename(filePath, ext), cells: rows };
  }
  if (ext === '.pptx') {
    const JSZip = require('jszip');
    const { XMLParser } = require('fast-xml-parser');
    const zip = await JSZip.loadAsync(buffer);
    const slideEntries = Object.values(zip.files).filter(entry => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name));
    const totalSlideBytes = slideEntries.reduce((total, entry) => total + (entry._data?.uncompressedSize || 0), 0);
    if (totalSlideBytes > 50 * 1024 * 1024) throw new Error('The presentation contains too much uncompressed slide XML to import safely.');
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    assertPresentationSlideLimit(names.length);
    const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: false });
    const slides = [];
    for (const name of names) {
      const xml = await zip.files[name].async('string');
      const texts = collectXmlText(parser.parse(xml)).filter(Boolean);
      slides.push({ title: texts[0] || `Slide ${slides.length + 1}`, body: texts.slice(1).join('\n') });
    }
    return { kind: 'slides', title: path.basename(filePath, ext), slides: slides.length ? slides : [{ title: 'Imported presentation', body: '' }] };
  }
  if (ext === '.txt' || ext === '.md' || ext === '.html') {
    assertDocumentTextLimit(buffer.byteLength);
    const text = decodeUtf8(buffer, 'This imported file is not valid UTF-8 text.');
    return { kind: ext === '.txt' ? 'notes' : 'pages', title: path.basename(filePath, ext), text, html: ext === '.html' ? text : undefined };
  }
  if (ext === '.bdesk') {
    const jsonText = decodeUtf8(buffer, 'This Brightdesk project file is not valid UTF-8 JSON.');
    let project;
    try { project = JSON.parse(jsonText); }
    catch { throw new Error('This Brightdesk project file is not valid JSON.'); }
    return validateProject(project);
  }
  throw new Error(`Brightdesk cannot open ${ext || 'this file type'} yet. Supported: DOCX, XLSX, CSV, PPTX, TXT, MD, HTML and BDESK.`);
}
function htmlToBlocks(html) {
  const stripped = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n');
  const noTags = stripped.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return noTags.split(/\n+/).map(text => text.trim()).filter(Boolean);
}
async function exportOfficeFile(payload, filePath) {
  const kind = payload.kind;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.bdesk') {
    const project = validateProject(payload.project);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2));
    return;
  }
  if (kind === 'pages' && ext === '.docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
    const blocks = payload.blocks?.length ? payload.blocks : htmlToBlocks(payload.html).map(text => ({ text, type: 'paragraph' }));
    const children = blocks.map(block => new Paragraph({
      heading: block.type === 'h1' ? HeadingLevel.HEADING_1 : block.type === 'h2' ? HeadingLevel.HEADING_2 : undefined,
      bullet: block.type === 'li' ? { indent: 360 } : undefined,
      children: [new TextRun({ text: block.text || '', bold: !!block.bold, italics: !!block.italic, underline: block.underline ? {} : undefined })]
    }));
    const doc = new Document({ sections: [{ children }] });
    await fs.writeFile(filePath, await Packer.toBuffer(doc)); return;
  }
  if (kind === 'sheets' && (ext === '.xlsx' || ext === '.xlsm')) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sourceSheets = Array.isArray(payload.worksheets) && payload.worksheets.length
      ? payload.worksheets
      : [{ name: payload.title || 'Sheet1', cells: payload.rows || [] }];
    if (sourceSheets.length > MAX_WORKSHEETS) throw new Error('The workbook exceeds the 256-worksheet limit.');
    const usedNames = new Set();
    let workbookCellCount = 0;
    let activeTab = 0;
    if (payload.activeWorksheetId) {
      const foundIndex = sourceSheets.findIndex(source => source?.id === payload.activeWorksheetId);
      if (foundIndex >= 0) activeTab = foundIndex;
    }
    sourceSheets.forEach((source, index) => {
      const name = assertWorksheetName(source?.name || (index === 0 ? payload.title || 'Sheet1' : `Sheet${index + 1}`), usedNames);
      const rows = source?.cells || (index === 0 ? payload.rows || [] : []);
      assertSheetCellLimit(rows);
      workbookCellCount += rows.reduce((count, row) => count + row.length, 0);
      if (workbookCellCount > MAX_SHEET_CELLS) throw new Error('The workbook exceeds the 250,000-cell limit.');
      const sheet = workbook.addWorksheet(name);
      rows.forEach((row, r) => row.forEach((value, c) => {
        const cell = sheet.getCell(r + 1, c + 1);
        if (typeof value === 'string' && value.startsWith('=')) cell.value = { formula: value.slice(1) };
        else cell.value = value === '' || value == null ? null : (Number.isFinite(Number(value)) && String(value).trim() !== '' ? Number(value) : value);
      }));
      sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
      sheet.columns.forEach(col => { col.width = 16; });
    });
    workbook.views = [{ activeTab, firstSheet: 0, visibility: 'visible' }];
    await workbook.xlsx.writeFile(filePath); return;
  }
  if (kind === 'sheets' && ext === '.csv') {
    const csv = (payload.rows || []).map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    await fs.writeFile(filePath, '\uFEFF' + csv, 'utf8'); return;
  }
  if (kind === 'slides' && ext === '.pptx') {
    const PptxGenJS = require('pptxgenjs');
    const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Brightdesk'; pptx.subject = 'Brightdesk presentation';
    for (const data of (payload.slides || [])) {
      const slide = pptx.addSlide(); slide.background = { color: 'F6F5FF' };
      slide.addText(data.title || '', { x: 0.8, y: 1.1, w: 11, h: 1.2, fontFace: 'Aptos Display', fontSize: 30, bold: true, color: '38356F' });
      slide.addText(data.body || '', { x: 0.85, y: 2.65, w: 10.8, h: 3.7, fontFace: 'Aptos', fontSize: 20, color: '55566B', breakLine: false, valign: 'top' });
    }
    await pptx.writeFile({ fileName: filePath }); return;
  }
  if (kind === 'pages' && ext === '.html') { await fs.writeFile(filePath, payload.html || '', 'utf8'); return; }
  if (kind === 'notes' && (ext === '.md' || ext === '.txt')) { await fs.writeFile(filePath, payload.text || '', 'utf8'); return; }
  throw new Error(`This export format is not available for ${kind}.`);
}
module.exports = { cleanFileName, parseCsv, parseTsv, ensureExtension, openOfficeFile, exportOfficeFile, validateProject, assertSheetDimensions };
