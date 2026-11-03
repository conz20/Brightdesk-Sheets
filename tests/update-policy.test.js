const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_UPDATE_SETTINGS, normalizeUpdateSettings, getUpdaterPreferences } = require('../src/update-policy');

test('automatic checking stays enabled while downloads and installs need approval', () => {
  assert.deepEqual(normalizeUpdateSettings(), { autoCheck: true, autoDownload: false, autoInstall: false });
});

test('legacy preferences cannot silently turn on automatic download or installation', () => {
  assert.deepEqual(normalizeUpdateSettings({ autoCheck: true, autoDownload: true, autoInstall: true }), {
    autoCheck: true, autoDownload: false, autoInstall: false
  });
});

test('customers can disable automatic checking without changing download approval rules', () => {
  assert.deepEqual(normalizeUpdateSettings({ autoCheck: false, autoDownload: true, autoInstall: true }), {
    autoCheck: false, autoDownload: false, autoInstall: false
  });
});

test('electron updater always waits for explicit download and installation actions', () => {
  assert.deepEqual(getUpdaterPreferences(), { autoDownload: false, autoInstallOnAppQuit: false });
});

test('safe default settings are immutable', () => {
  assert.deepEqual(DEFAULT_UPDATE_SETTINGS, { autoCheck: true, autoDownload: false, autoInstall: false });
});
