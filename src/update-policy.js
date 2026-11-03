'use strict';

const DEFAULT_UPDATE_SETTINGS = Object.freeze({
  autoCheck: true,
  autoDownload: false,
  autoInstall: false
});

function normalizeUpdateSettings(settings = {}) {
  return {
    autoCheck: settings?.autoCheck !== false,
    // Ignore legacy preferences. These actions always require a customer click.
    autoDownload: false,
    autoInstall: false
  };
}

function getUpdaterPreferences() {
  return Object.freeze({
    autoDownload: false,
    autoInstallOnAppQuit: false
  });
}

module.exports = {
  DEFAULT_UPDATE_SETTINGS,
  normalizeUpdateSettings,
  getUpdaterPreferences
};
