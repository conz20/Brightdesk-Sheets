const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer exposes language selection and a browse-only dictionary catalogue', () => {
  const html = read('src/index.html');
  const app = read('src/app.js');
  const preload = read('src/preload.js');
  const main = read('src/main.js');
  assert.match(html, /id="display-language"/);
  assert.match(html, /id="proofing-language"/);
  assert.match(html, /id="proofing-dictionary"/);
  assert.match(app, /Not included in this build/);
  assert.doesNotMatch(app, /installCatalogueDictionary/);
  for (const forbidden of ['import-language-pack', 'import-spelling-dictionary']) assert.doesNotMatch(html, new RegExp(forbidden));
  for (const forbidden of ['importLanguagePack', 'removeLanguagePack', 'importDictionary', 'removeDictionary']) assert.doesNotMatch(preload, new RegExp(forbidden));
  for (const forbidden of [
    /ipcMain\.handle\('languages:import'/,
    /ipcMain\.handle\('languages:remove'/,
    /ipcMain\.handle\('dictionaries:import'/,
    /ipcMain\.handle\('dictionaries:remove'/
  ]) {
    assert.doesNotMatch(main, forbidden);
  }
  assert.doesNotMatch(main, /dictionaries:install-catalog/);
  assert.doesNotMatch(preload, /installCatalogueDictionary|dictionaries:install-catalog/);
});

test('dictionary centre explains local use and official Brightdesk update delivery', () => {
  const html = read('src/index.html');
  assert.match(html, /Installed dictionary resources are protected/);
  assert.match(html, /does not download dictionary files from third-party hosts at runtime/);
  assert.match(html, /Use installed dictionaries offline/);
  assert.match(html, /additional dictionary files can become available only when included in a verified official Brightdesk update/i);
});

test('fresh suite installs activate only implemented apps; standalone installs lock to one app', () => {
  const app = read('src/app.js');
  assert.match(app, /installableCatalog\.map\(item => item\.id\)/);
  assert.match(app, /state\.setupComplete = state\.installedApps\.length > 0/);
  assert.match(app, /if \(launchAppId\) \{ state\.app = launchAppId; state\.view = 'workspace'; \}/);
  assert.match(app, /launchAppId && app !== launchAppId/);
});

test('Windows installer displays the Brightdesk licence and offers a normal setup flow', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.license, 'TERMS_AND_CONDITIONS.txt');
  assert.equal(pkg.build.pkg.license, 'TERMS_AND_CONDITIONS.txt');
  assert.ok(pkg.build.mac.target.includes('pkg'));
  assert.equal(pkg.build.nsis.createDesktopShortcut, true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut, true);
});

test('release workflow uses supported branch and tag event filters with direct draft-release assets', () => {
  const workflow = read('.github/workflows/product-installers.yml');
  assert.match(workflow, /node-version: 24\.22\.2/);
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.match(workflow, /npm run verify:licenses/);
  assert.match(workflow, /npm run release:preflight/);
  assert.match(workflow, /npm run dist:product:\$\{\{ matrix\.platform \}\}/);
  assert.match(workflow, /npm run verify:product:\$\{\{ matrix\.platform \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/, 'installer builds must not depend on manual dispatch');
  const pushStart = workflow.indexOf('\n  push:\n');
  const scheduleStart = workflow.indexOf('\n  schedule:\n', pushStart);
  const permissionsStart = workflow.indexOf('\npermissions:\n', pushStart);
  const pushEnd = scheduleStart >= 0 ? scheduleStart : permissionsStart;
  assert.ok(pushStart >= 0 && pushEnd > pushStart, 'push trigger exists');
  const pushTrigger = workflow.slice(pushStart, pushEnd);
  assert.match(pushTrigger, /branches: \[main\]/);
  assert.match(pushTrigger, /tags: \['v\*'\]/, 'version tags are the explicit release trigger');
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /runner: \["self-hosted", "Windows", "X64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "macOS", "ARM64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "Linux", "X64"\]/);
  assert.doesNotMatch(workflow, /windows-latest|macos-latest|ubuntu-latest/, 'platform builds must use private self-hosted runners');

  const prepare = workflow.slice(workflow.indexOf('  prepare-release:'), workflow.indexOf('  release-assets:'));
  const releaseAssets = workflow.slice(workflow.indexOf('  release-assets:'), workflow.indexOf('  publish-release:'));
  const publish = workflow.slice(workflow.indexOf('  publish-release:'));
  assert.ok(prepare.includes('EXPECTED_TAG="v$VERSION"'), 'release tag must match package.json version');
  assert.ok(prepare.includes('GITHUB_REF_NAME'), 'version tag is checked before creating a draft release');
  assert.ok(prepare.includes('draft: true'), 'release begins unpublished');
  assert.match(releaseAssets, /release\/apps\/[a-z-]+\/\*\*/);
  assert.ok(releaseAssets.includes('fail_on_unmatched_files: true'));
  assert.ok(releaseAssets.includes('draft: true'));
  assert.ok(publish.includes('needs: release-assets'));
  assert.ok(publish.includes('draft: false'));
  assert.ok(publish.includes('contents: write'));
  assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact/, 'release files must not use Actions artifact storage');
  assert.ok(workflow.includes('softprops/action-gh-release@8a0cd651e5b2365bd640854a3fa5dfc70e4875f3 # v3.0.4'));
});
