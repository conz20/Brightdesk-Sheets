'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('product navigation can collapse to an icon rail and expand accessibly', () => {
  const html = read('src/index.html');
  const js = read('src/app.js');
  const css = read('src/styles.css');
  assert.ok(html.includes('id="sidebar-toggle"'));
  assert.ok(html.includes('aria-label="Brightdesk Sheets" title="Brightdesk Sheets"'));
  assert.ok(html.includes('<svg class="app-icon manager-icon" viewBox="0 0 24 24"'));
  assert.ok(js.includes('function setSidebarCompact(compact)'));
  assert.ok(js.includes('sidebarPreference'));
  assert.ok(js.includes('aria-expanded'));
  assert.ok(css.includes('width: 76px;'));
  assert.ok(css.includes('.sidebar.is-compact .brand > div'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
});
