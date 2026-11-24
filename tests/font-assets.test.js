'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative));

test('Brightdesk Sheets loads and packages the approved Inter normal and italic faces offline', () => {
  const html = read('src/index.html').toString('utf8');
  const css = read('src/fonts.css').toString('utf8');
  const license = read('src/assets/fonts/licenses/inter-OFL.txt').toString('utf8');
  assert.match(html, /href="fonts\.css"/);
  assert.match(css, /font-family: "Inter"/);
  assert.match(css, /Inter\[opsz,wght\]\.ttf/);
  assert.match(css, /Inter-Italic\[opsz,wght\]\.ttf/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  const files = [
    ['src/assets/fonts/inter/Inter[opsz,wght].ttf', '29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031'],
    ['src/assets/fonts/inter/Inter-Italic[opsz,wght].ttf', 'acd98e64795781b2058f07b18475e0ecee2a0fe2b42a49e2f9e37d0d6bf66ce6']
  ];
  for (const [file, expected] of files) {
    const digest = crypto.createHash('sha256').update(read(file)).digest('hex');
    assert.equal(digest, expected);
  }
});
