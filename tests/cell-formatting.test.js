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

test('applies formatting to every cell in a selected rectangular range', () => {
  const styles = updateCellStylesInRange({ C3: { italic: true } }, {
    top: 0, left: 0, bottom: 1, right: 1
  }, { bold: true, fill: '#EDF7F1' });

  assert.equal(styles.A1.bold, true);
  assert.equal(styles.B1.bold, true);
  assert.equal(styles.A2.bold, true);
  assert.equal(styles.B2.bold, true);
  assert.equal(styles.C3.italic, true);
  assert.equal(styles.C3.bold, undefined);
});

test('clears formatting only inside the selected rectangular range', () => {
  const styles = removeCellStylesInRange({
    A1: { bold: true }, B1: { italic: true }, C1: { underline: true }
  }, { top: 0, left: 0, bottom: 0, right: 1 });

  assert.deepEqual(styles, { C1: { underline: true } });
});

test('rejects style ranges that exceed the worksheet cell limit', () => {
  assert.throws(() => updateCellStylesInRange({}, {
    top: 0, left: 0, bottom: 500, right: 500
  }, { bold: true }), /250,000-cell limit/i);
});
