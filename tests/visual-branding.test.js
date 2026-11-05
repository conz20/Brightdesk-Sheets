'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Brightdesk Sheets bundles and displays its own branded application icon',()=>{const root=path.join(__dirname,'..');const icon=fs.readFileSync(path.join(root,'src','assets','icons','sheets.svg'),'utf8');const html=fs.readFileSync(path.join(root,'src','index.html'),'utf8');assert.match(icon,/<svg[^>]+role="img"/);assert.ok(html.includes('assets/icons/sheets.svg'));assert.ok(html.includes('assets/brand/brightdesk-mark.svg'));});

test('Brightdesk Sheets uses the approved deep-navy navigation surface', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  assert.match(css, /\.sidebar\s*\{[^}]*background:\s*#17243e/i);
  assert.match(css, /\.sidebar \.nav\s*\{[^}]*color:\s*#e1e8f4/i);
  assert.match(css, /\.sidebar \.nav\.active\s*\{[^}]*background:\s*#e9e7ff/i);
});
