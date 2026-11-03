const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('the Electron main process cannot enable background updates', () => {
  const main = fs.readFileSync(require('node:path').join(__dirname, '../src/main.js'), 'utf8');
  assert.ok(main.includes('Object.assign(autoUpdater, getUpdaterPreferences())'));
  assert.ok(!main.includes('autoUpdater.autoDownload = true'));
  assert.ok(!main.includes('autoUpdater.autoInstallOnAppQuit = true'));
});

test('the app exposes separate customer actions to download and install an update', () => {
  const path = require('node:path');
  const uiPath = fs.existsSync(path.join(__dirname, '../src/update-settings.js'))
    ? path.join(__dirname, '../src/update-settings.js')
    : path.join(__dirname, '../src/app.js');
  const ui = fs.readFileSync(uiPath, 'utf8');
  assert.match(ui, /update-manual-download|Download update/);
  assert.match(ui, /update-manual-install|Install update/);
});
