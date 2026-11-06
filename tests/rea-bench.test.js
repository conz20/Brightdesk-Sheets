const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { inspect, sha256, markdown, inventoryFileEntries } = require('../scripts/brightdesk-rea');

const root = path.join(__dirname, '..');

test('Brightdesk REA Bench inventories project files with stable SHA-256 evidence', () => {
  const report = inspect(root);
  assert.equal(report.tool, 'Brightdesk REA Bench');
  assert.ok(report.inventory.fileCount > 10);
  assert.ok(report.inventory.files.some(f => f.path === 'src/app-catalog.js'));
  assert.match(sha256(Buffer.from('abc')), /^[a-f0-9]{64}$/);
});

test('Brightdesk REA Bench verifies the fixed ten-app scope', () => {
  const report = inspect(root);
  assert.deepEqual(report.catalogue.apps.map(a => a.id), ['pages','sheets','slides','notes','database','forms','lists','planner','todo','loop']);
  assert.equal(report.findings.some(f => f.id === 'catalog-scope-drift'), false);
});

test('REA report clearly states static-only evidence boundaries', () => {
  const report = inspect(root);
  const md = markdown(report);
  assert.match(md, /Static source inspection only/);
  assert.match(md, /No target execution/);
});

test('REA inventory skips files that disappear during a concurrent scan and reports them', () => {
  const files = [
    { path: 'src/stable.js', size: 6, ext: '.js', abs: '/virtual/src/stable.js' },
    { path: 'native/brightdesk-seed-test-20302.node', size: 12, ext: '.node', abs: '/virtual/native/brightdesk-seed-test-20302.node' }
  ];
  const result = inventoryFileEntries(files, (absolutePath) => {
    if (absolutePath.endsWith('/stable.js')) return Buffer.from('source', 'utf8');
    const error = new Error('temporary native file disappeared');
    error.code = 'ENOENT';
    throw error;
  });

  assert.equal(result.inventory.length, 1);
  assert.deepEqual(result.inventory[0], {
    path: 'src/stable.js',
    size: 6,
    sha256: sha256(Buffer.from('source', 'utf8')),
    extension: '.js'
  });
  assert.deepEqual(result.missingFiles, ['native/brightdesk-seed-test-20302.node']);
  assert.equal(result.files[0].buffer.toString('utf8'), 'source');
});
