const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'src');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'product-window.css'), 'utf8');
test('an individual product launch selects the focused product window', () => {
  assert.match(app, /if \(launchAppId\) document\.documentElement\.classList\.add\('is-product-window'\)/);
  assert.match(app, /Boolean\(launchAppId\)/);
  assert.match(app, /PRODUCT WORKSPACE/);
});
test('the product uses its original SVG icon in the product header', () => {
  assert.ok(app.includes("icon.src = 'assets/icons/sheets.svg'"));
  assert.match(app, /product-title-icon/);
});
test('the product window keeps adaptive product navigation and its own workspace', () => {
  assert.match(html, /href="product-window\.css"/);
  assert.match(css, /html\.is-product-window body\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /html\.is-product-window \.sidebar\s*\{[^}]*display:\s*flex\s*!important;/s);
      assert.doesNotMatch(css, /html\.is-product-window \.sidebar\{display:none!important\}/);
  assert.match(css, /html\.is-product-window \.workspace\s*\{[^}]*flex:1 1 auto/s);
});
