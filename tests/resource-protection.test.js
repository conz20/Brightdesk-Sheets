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

test('release workflow has working install and release permissions', () => {
  const suiteWorkflowPath = path.join(root, '.github', 'workflows', 'build-release.yml');
  if (fs.existsSync(suiteWorkflowPath)) {
    const workflow = fs.readFileSync(suiteWorkflowPath, 'utf8');
    assert.match(workflow, /node-version: 24\.22\.2/);
    assert.match(workflow, /run: npm ci/);
    assert.match(workflow, /npm run verify:licenses/);
    assert.match(workflow, /npm run release:preflight/);
    const buildHelper = fs.readFileSync(path.join(root, 'scripts', 'build-in-docker.sh'), 'utf8');
    assert.match(buildHelper, /npm run release:verify:win/);
    assert.match(buildHelper, /npm run release:verify:linux/);
    assert.match(workflow, /npm run release:verify:mac/);
    assert.match(workflow, /WIN_CSC_LINK/);
    assert.match(workflow, /MAC_INSTALLER_CSC_LINK/);
    assert.match(workflow, /APPLE_APP_SPECIFIC_PASSWORD/);
    for (const command of ['npm run dist:products:linux', 'npm run dist:products:win']) {
      assert.ok(buildHelper.includes(command), `Docker helper includes ${command}`);
    }
    assert.ok(workflow.includes('npm run dist:products:mac'));
    for (const command of ['npm run release:verify:products:linux', 'npm run release:verify:products:win']) {
      assert.ok(buildHelper.includes(command), `Docker helper includes ${command}`);
    }
    assert.ok(workflow.includes('npm run release:verify:products:mac'));
    assert.match(workflow, /Brightdesk-Builds/);
    assert.doesNotMatch(workflow, /actions\/(?:upload|download)-artifact/);
    assert.doesNotMatch(workflow, /contents: write/);
    return;
  }

  const workflow = read('.github/workflows/product-installers.yml');
  assert.match(workflow, /node-version: 24\.22\.2/);
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.match(workflow, /npm run verify:licenses/);
  assert.match(workflow, /npm run release:preflight/);
  assert.match(workflow, /npm run dist:product:\$\{\{ matrix\.platform \}\}/);
  assert.match(workflow, /npm run verify:product:\$\{\{ matrix\.platform \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/, 'installer builds must not depend on manual dispatch');
  assert.match(workflow, /tags: \['v\*'\]/, 'version tags are the explicit release trigger');
  assert.doesNotMatch(workflow, /windows-latest|macos-latest|ubuntu-latest/, 'platform builds must use private self-hosted runners');
  assert.match(workflow, /runner: \["self-hosted", "Windows", "X64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "macOS", "ARM64"\]/);
  assert.match(workflow, /runner: \["self-hosted", "Linux", "X64"\]/);
  const publish = workflow.slice(workflow.indexOf('  publish-release:'));
  assert.match(publish, /if: github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(publish, /tag_name: \$\{\{ github\.ref_name \}\}/);
  assert.match(publish, /contents: write/);
  assert.match(publish, /needs: release-assets/);
  assert.match(workflow, /prepare-release:[\\s\\S]*?draft: true/);
  assert.match(workflow, /release-assets:[\\s\\S]*?fail_on_unmatched_files: true/);
  assert.match(workflow, /draft: false/);
  assert.doesNotMatch(workflow, /actions\\/(?:upload|download)-artifact/, 'release assets must not use Actions artifact storage');
});
