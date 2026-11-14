'use strict';

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function measureSnapshot(value) {
  return JSON.stringify(value).length * 2;
}

function trimSnapshots(history, side) {
  const snapshots = history[side];
  const bytesKey = side === 'past' ? 'pastBytes' : 'futureBytes';
  while (snapshots.length > history.limit || history.pastBytes + history.futureBytes > history.maxBytes) {
    if (!snapshots.length) break;
    const removed = snapshots.shift();
    history[bytesKey] -= removed.bytes;
  }
}

function createHistory(options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 64 * 1024 * 1024;
  const clone = typeof options.clone === 'function' ? options.clone : cloneValue;
  return { limit, maxBytes, clone, past: [], future: [], pastBytes: 0, futureBytes: 0 };
}

function capture(history, snapshot) {
  if (!history || !Array.isArray(history.past) || !Array.isArray(history.future)) {
    throw new TypeError('A valid Brightdesk sheet history is required.');
  }
  const copy = history.clone(snapshot);
  const bytes = measureSnapshot(copy);
  history.future.length = 0;
  history.futureBytes = 0;
  if (bytes > history.maxBytes) {
    history.past.length = 0;
    history.pastBytes = 0;
    return false;
  }
  history.past.push({ value: copy, bytes });
  history.pastBytes += bytes;
  trimSnapshots(history, 'past');
  return true;
}

function undo(history, current) {
  if (!canUndo(history)) return null;
  const entry = history.past.pop();
  history.pastBytes -= entry.bytes;
  const copy = history.clone(current);
  const bytes = measureSnapshot(copy);
  if (bytes <= history.maxBytes) {
    history.future.push({ value: copy, bytes });
    history.futureBytes += bytes;
    trimSnapshots(history, 'future');
  }
  return history.clone(entry.value);
}

function redo(history, current) {
  if (!canRedo(history)) return null;
  const entry = history.future.pop();
  history.futureBytes -= entry.bytes;
  const copy = history.clone(current);
  const bytes = measureSnapshot(copy);
  if (bytes <= history.maxBytes) {
    history.past.push({ value: copy, bytes });
    history.pastBytes += bytes;
    trimSnapshots(history, 'past');
  }
  return history.clone(entry.value);
}

function canUndo(history) {
  return Boolean(history && Array.isArray(history.past) && history.past.length);
}

function canRedo(history) {
  return Boolean(history && Array.isArray(history.future) && history.future.length);
}

const api = { createHistory, capture, undo, redo, canUndo, canRedo };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.BrightdeskSheetHistory = api;
