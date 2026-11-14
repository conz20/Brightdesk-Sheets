'use strict';

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createHistory(options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const clone = typeof options.clone === 'function' ? options.clone : cloneValue;
  return { limit, clone, past: [], future: [] };
}

function capture(history, snapshot) {
  if (!history || !Array.isArray(history.past) || !Array.isArray(history.future)) {
    throw new TypeError('A valid Brightdesk sheet history is required.');
  }
  history.past.push(history.clone(snapshot));
  if (history.past.length > history.limit) history.past.splice(0, history.past.length - history.limit);
  history.future.length = 0;
  return history.past.length;
}

function undo(history, current) {
  if (!canUndo(history)) return null;
  history.future.push(history.clone(current));
  return history.clone(history.past.pop());
}

function redo(history, current) {
  if (!canRedo(history)) return null;
  history.past.push(history.clone(current));
  if (history.past.length > history.limit) history.past.shift();
  return history.clone(history.future.pop());
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
