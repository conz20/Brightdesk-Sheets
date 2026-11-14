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

  return { DEFAULT_STYLE, normalizeCellStyle, formatCellDisplay, updateCellStyle, removeCellStyle };
});
