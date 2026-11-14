(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BrightdeskCellFormatting = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const NUMBER_FORMATS = new Set(['general', 'number', 'currency', 'percent', 'date']);
  const DEFAULT_STYLE = Object.freeze({
    bold: false,
    italic: false,
    underline: false,
    fill: null,
    color: null,
    numberFormat: 'general'
  });
  const SAFE_COLOUR = /^#[0-9a-f]{6}$/i;

  function normalizeCellStyle(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const style = {};
    for (const key of ['bold', 'italic', 'underline']) {
      if (typeof source[key] === 'boolean') style[key] = source[key];
    }
    for (const key of ['fill', 'color']) {
      style[key] = typeof source[key] === 'string' && SAFE_COLOUR.test(source[key]) ? source[key].toUpperCase() : null;
    }
    style.numberFormat = NUMBER_FORMATS.has(source.numberFormat) ? source.numberFormat : 'general';
    return style;
  }

  function formatCellDisplay(rawValue, styleValue) {
    const raw = rawValue == null ? '' : String(rawValue);
    const style = normalizeCellStyle(styleValue);
    if (!raw || raw.startsWith('=')) return raw;
    if (style.numberFormat === 'general') return raw;
    if (style.numberFormat === 'date') {
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return raw;
      const [, year, month, day] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return raw;
      return new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    }
    const number = Number(raw);
    if (!Number.isFinite(number)) return raw;
    const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    if (style.numberFormat === 'currency') {
      return new Intl.NumberFormat('en-AU', { ...options, style: 'currency', currency: 'AUD' }).format(number);
    }
    if (style.numberFormat === 'percent') {
      return new Intl.NumberFormat('en-AU', { ...options, style: 'percent' }).format(number);
    }
    return new Intl.NumberFormat('en-AU', options).format(number);
  }

  function updateCellStyle(styles, address, changes) {
    const source = styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {};
    const key = String(address || '').toUpperCase();
    if (!/^[A-Z]{1,3}[1-9]\d*$/.test(key)) throw new TypeError('A valid cell address is required.');
    const current = { ...DEFAULT_STYLE, ...normalizeCellStyle(source[key]) };
    const next = normalizeCellStyle({ ...current, ...(changes || {}) });
    return { ...source, [key]: next };
  }

  function removeCellStyle(styles, address) {
    const next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    delete next[String(address || '').toUpperCase()];
    return next;
  }

  function columnLabel(index) {
    if (!Number.isInteger(index) || index < 0 || index >= 16_384) throw new RangeError('The selected column is outside the supported spreadsheet range.');
    let value = index + 1;
    let label = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  }

  function normalizeStyleRange(range) {
    if (!range || !Number.isInteger(range.top) || !Number.isInteger(range.left) ||
        !Number.isInteger(range.bottom) || !Number.isInteger(range.right) ||
        range.top < 0 || range.left < 0 || range.bottom < range.top || range.right < range.left ||
        range.bottom >= 1_048_576 || range.right >= 16_384) {
      throw new RangeError('Choose a valid cell range.');
    }
    const rows = range.bottom - range.top + 1;
    const columns = range.right - range.left + 1;
    if (rows > Math.floor(250_000 / columns)) throw new RangeError('The selected range exceeds the 250,000-cell limit.');
    return { top: range.top, left: range.left, bottom: range.bottom, right: range.right };
  }

  function updateCellStylesInRange(styles, range, changes) {
    const selected = normalizeStyleRange(range);
    let next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    for (let row = selected.top; row <= selected.bottom; row += 1) {
      for (let col = selected.left; col <= selected.right; col += 1) {
        const address = columnLabel(col) + (row + 1);
        const current = { ...DEFAULT_STYLE, ...normalizeCellStyle(next[address]) };
        next[address] = normalizeCellStyle({ ...current, ...(changes || {}) });
      }
    }
    return next;
  }

  function removeCellStylesInRange(styles, range) {
    const selected = normalizeStyleRange(range);
    let next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    for (let row = selected.top; row <= selected.bottom; row += 1) {
      for (let col = selected.left; col <= selected.right; col += 1) {
        delete next[columnLabel(col) + (row + 1)];
      }
    }
    return next;
  }

  function fillCellStylesDown(styles, range) {
    const selected = normalizeStyleRange(range);
    const next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    for (let row = selected.top + 1; row <= selected.bottom; row += 1) {
      for (let col = selected.left; col <= selected.right; col += 1) {
        const sourceAddress = columnLabel(col) + (selected.top + 1);
        const targetAddress = columnLabel(col) + (row + 1);
        if (next[sourceAddress]) next[targetAddress] = normalizeCellStyle(next[sourceAddress]);
        else delete next[targetAddress];
      }
    }
    return next;
  }

  function fillCellStylesRight(styles, range) {
    const selected = normalizeStyleRange(range);
    const next = { ...(styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {}) };
    for (let row = selected.top; row <= selected.bottom; row += 1) {
      for (let col = selected.left + 1; col <= selected.right; col += 1) {
        const sourceAddress = columnLabel(selected.left) + (row + 1);
        const targetAddress = columnLabel(col) + (row + 1);
        if (next[sourceAddress]) next[targetAddress] = normalizeCellStyle(next[sourceAddress]);
        else delete next[targetAddress];
      }
    }
    return next;
  }

  return { DEFAULT_STYLE, normalizeCellStyle, formatCellDisplay, updateCellStyle, removeCellStyle, updateCellStylesInRange, removeCellStylesInRange, fillCellStylesDown, fillCellStylesRight };
});
