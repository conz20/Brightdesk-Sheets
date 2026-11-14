'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { APP_SLUGS } = require('../src/standalone-downloads');

test('Electron main process imports the shared standalone app catalogue before validating its product ID', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.match(
    source,
    /const\s+\{\s*APP_SLUGS\s*\}\s*=\s*require\(['"]\.\/standalone-downloads['"]\);/
  );
  assert.deepEqual(Object.keys(APP_SLUGS).sort(), ["database","forms","lists","loop","notes","pages","planner","sheets","slides","todo"]);
});
