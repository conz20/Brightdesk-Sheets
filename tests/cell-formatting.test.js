const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCellStyle,
  formatCellDisplay,
  updateCellStyle,
  removeCellStyle
} = require('../src/cell-formatting');

test('normalizes supported cell formatting without accepting arbitrary properties', () => {
  assert.deepEqual(normalizeCellStyle({
    bold: true,
    italic: true,
    underline: true,
    fill: '#E8F4EC',
    color: '#20543A',
    numberFormat: 'currency',
    unexpected: 'ignored'
  }), {
    bold: true,
    italic: true,
    underline: true,
    fill: '#E8F4EC',
    color: '#20543A',
    numberFormat: 'currency'
  });
});

test('rejects unsafe colours and unknown number formats', () => {
  assert.equal(normalizeCellStyle({ fill: 'url(javascript:alert(1))' }).fill, null);
  assert.equal(normalizeCellStyle({ color: 'red; background:url(x)' }).color, null);
  assert.equal(normalizeCellStyle({ numberFormat: 'custom-code' }).numberFormat, 'general');
});

test('formats numeric values for number, currency and percentage without changing raw data', () => {
  assert.equal(formatCellDisplay('1234.5', { numberFormat: 'number' }), '1,234.50');
  assert.equal(formatCellDisplay('1234.5', { numberFormat: 'currency' }), '$1,234.50');
  assert.equal(formatCellDisplay('0.25', { numberFormat: 'percent' }), '25.00%');
  assert.equal(formatCellDisplay('text', { numberFormat: 'currency' }), 'text');
});

test('formats valid ISO dates and leaves invalid date text unchanged', () => {
  assert.equal(formatCellDisplay('2026-11-14', { numberFormat: 'date' }), '14/11/2026');
  assert.equal(formatCellDisplay('not-a-date', { numberFormat: 'date' }), 'not-a-date');
});

test('updates one cell style without mutating other cells', () => {
  const styles = { A1: { bold: true }, B2: { italic: true } };
  const updated = updateCellStyle(styles, 'A1', { italic: true, fill: '#E8F4EC' });
  assert.deepEqual(updated.A1, { bold: true, italic: true, fill: '#E8F4EC', underline: false, color: null, numberFormat: 'general' });
  assert.deepEqual(updated.B2, { italic: true });
  assert.deepEqual(styles.A1, { bold: true });
});

test('removes a cell style when all formatting is reset', () => {
  assert.deepEqual(removeCellStyle({ A1: { bold: true } }, 'A1'), {});
});
