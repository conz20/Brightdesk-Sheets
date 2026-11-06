'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Brightdesk Sheets bundles and displays its own branded application icon',()=>{const root=path.join(__dirname,'..');const icon=fs.readFileSync(path.join(root,'src','assets','icons','sheets.svg'),'utf8');const html=fs.readFileSync(path.join(root,'src','index.html'),'utf8');assert.match(icon,/<svg[^>]+role="img"/);assert.ok(html.includes('assets/icons/sheets.svg'));assert.ok(html.includes('assets/brand/brightdesk-mark.svg'));});

test('final stylesheet tokens match the exact approved Sheets palette', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'src', 'design-system.css'), 'utf8');
  const lastHex = (token) => {
    const values = [...css.matchAll(new RegExp(token + String.raw`\s*:\s*(#[0-9a-f]{6})`, 'gi'))];
    return values.at(-1)?.[1].toUpperCase();
  };

  assert.equal(lastHex('--bd-accent'), '#27845C');
  assert.equal(lastHex('--bd-accent-strong'), '#1E6847');
  assert.equal(lastHex('--bd-accent-soft'), '#EDF7F1');
  assert.equal(lastHex('--bd-product-tint'), '#EDF7F1');
  assert.equal(lastHex('--bd-canvas'), '#F3F6FA');
  assert.equal(lastHex('--bd-ink'), '#202B3C');
});
