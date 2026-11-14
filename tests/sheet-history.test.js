const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, capture, undo, redo, canUndo, canRedo } = require('../src/sheet-history');

test('undo restores the previous workbook snapshot without sharing mutable data', () => {
  const history = createHistory();
  const workbook = { cells: [['before']] };
  capture(history, workbook);
  workbook.cells[0][0] = 'after';

  const restored = undo(history, workbook);
  assert.deepEqual(restored, { cells: [['before']] });
  restored.cells[0][0] = 'changed';
  assert.equal(workbook.cells[0][0], 'after');
});

test('redo reapplies the change after undo', () => {
  const history = createHistory();
  const before = { cells: [['before']] };
  const after = { cells: [['after']] };
  capture(history, before);
  const undone = undo(history, after);
  assert.deepEqual(undone, before);
  const redone = redo(history, undone);
  assert.deepEqual(redone, after);
});

test('a new edit after undo clears the redo history', () => {
  const history = createHistory();
  const first = { value: 1 };
  capture(history, first);
  const second = { value: 2 };
  const restored = undo(history, second);
  capture(history, { value: 3 });
  assert.equal(canRedo(history), false);
  assert.deepEqual(redo(history, restored), restored);
});

test('history is bounded to the configured number of snapshots', () => {
  const history = createHistory({ limit: 2 });
  capture(history, { value: 1 });
  capture(history, { value: 2 });
  capture(history, { value: 3 });
  assert.deepEqual(undo(history, { value: 4 }), { value: 3 });
  assert.deepEqual(undo(history, { value: 3 }), { value: 2 });
  assert.equal(undo(history, { value: 2 }), null);
});

test('empty undo and redo return null and expose their availability', () => {
  const history = createHistory();
  assert.equal(undo(history, { value: 1 }), null);
  assert.equal(redo(history, { value: 1 }), null);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
});
