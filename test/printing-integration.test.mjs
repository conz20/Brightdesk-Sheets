import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const read=file=>fs.readFileSync(path.join(process.cwd(),file),"utf8");

test("Printing snapshot is the dependency-free approved upstream version",()=>{
 const pkg=JSON.parse(read("src/printing-package/package.json"));const source=JSON.parse(read("src/printing-package/UPSTREAM.json"));
 assert.equal(pkg.name,"@brightdesk/printing");assert.equal(pkg.version,"0.1.0");assert.deepEqual(pkg.dependencies||{},{});
 assert.equal(source.sourceRepository,"conz20/Brightdesk-Printing");assert.equal(source.sourceCommit,"70d41095616c6d1cd3473c0ad73a6ecb5a596c05");
 for(const file of ["index.mjs","index.d.ts","src/electron-print-adapter.mjs","src/printing-error.mjs","src/validate-print-request.mjs","src/ipp-printer-discovery.mjs","src/printer-settings.mjs","src/printer-capabilities.mjs"])assert.ok(fs.statSync(path.join(process.cwd(),"src/printing-package",file)).isFile(),file);
});

test("the Sheets workspace contains shared Print actions",()=>{
 const html=read("src/index.html"),app=read("src/app.js"),main=read("src/main.js"),preload=read("src/preload.js");
 assert.match(html,/id="print-button"/);assert.match(html,/id="printer-settings-button"/);
 assert.ok(app.includes("window.brightdesk.printing.print({ printBackground: true })"));
 assert.ok(app.includes("window.brightdesk.printing.openPrinterSettings()"));
 assert.match(main,/registerPrintingIpcHandlers/);
 assert.match(preload,/printing:list-printers/);
});

test("all built-in language packs include printing labels",()=>{
 for(const locale of ["en-AU","de-DE","es-ES","fr-FR"]){const pack=JSON.parse(read("src/languages/"+locale+".json"));assert.ok(pack.translations["top.print"]);assert.ok(pack.translations["top.printerSettings"]);}
});

test("macOS and Windows native printer discovery sources and build script are included",()=>{
 const script=read("scripts/build-printing-native.js");
 for(const file of [
  "src/printing-package/native/macos/ipp-printer-discovery.swift",
  "src/printing-package/native/windows/ipp-printer-discovery.cpp",
  "src/printing-package/tools/build-macos-printer-discovery.sh",
  "src/printing-package/tools/build-windows-printer-discovery.ps1",
 ]) assert.ok(fs.statSync(path.join(process.cwd(),file)).isFile(),file);
 assert.match(script,/build-macos-printer-discovery\.sh/);
 assert.match(script,/build-windows-printer-discovery\.ps1/);
 assert.match(script,/process\.platform/);
});

test("all standalone installer configurations unpack native helpers and declare macOS local-network access",()=>{
 const pkg=JSON.parse(read("package.json"));
 for(const target of [
  "src/printing-package/native/macos/brightdesk-ipp-discovery",
  "src/printing-package/native/windows/brightdesk-ipp-discovery.exe",
 ]) assert.ok(pkg.build.asarUnpack.includes(target),target);
 assert.deepEqual(pkg.build.mac.extendInfo.NSBonjourServices,["_ipp._tcp","_ipps._tcp","_printer._tcp"]);
 assert.match(pkg.build.mac.extendInfo.NSLocalNetworkUsageDescription,/printer/i);
 for(const name of ["dist","dist:win","dist:mac","dist:linux","release"])assert.ok(pkg.scripts[name].includes("build:printing-native"),name);
 const config=read("electron-builder.app.config.js");
 const buildApp=read("scripts/build-app.js");
 assert.ok(buildApp.includes("build-printing-native.js"));
 assert.ok(config.includes("'src/printing-package/native/macos/brightdesk-ipp-discovery'"));
 assert.match(config,/NSBonjourServices/);
 assert.match(config,/NSLocalNetworkUsageDescription/);
});


test("macOS printer discovery helper is a universal Apple Silicon and Intel executable",()=>{
 const macBuild=read("src/printing-package/tools/build-macos-printer-discovery.sh");
 const upstream=JSON.parse(read("src/printing-package/UPSTREAM.json"));
 assert.match(macBuild,/arm64-apple-macosx/);
 assert.match(macBuild,/x86_64-apple-macosx/);
 assert.match(macBuild,/xcrun lipo -create/);
 assert.ok(macBuild.includes('lipo "$OUTPUT" -verify_arch arm64 x86_64'));
 assert.equal(upstream.localPatches.macOSBuildScript.sourceCommit,"1b1d7264413520885b400884103095196377a659");

 const windowsBuild=read("src/printing-package/tools/build-windows-printer-discovery.ps1");
 assert.ok(windowsBuild.includes('$TempDir = Join-Path'));
 assert.ok(windowsBuild.includes('$Object = Join-Path $TempDir'));
 assert.ok(windowsBuild.includes('finally {'));
 assert.ok(windowsBuild.includes('Remove-Item -LiteralPath $TempDir -Recurse -Force'));
 assert.equal(upstream.localPatches.windowsBuildScript.sourceCommit,"bb057ac192faa714e92deb218768506301d21367");

});


test("prepares a content-only print document for every Brightdesk product", () => {
  const app = read("src/app.js");
  const css = read("src/styles.css");
  assert.match(app, /const PRINTABLE_APP_TARGETS/);
  assert.match(app, /createBrightdeskPrintDocument/);
  assert.match(app, /activeDoc\(\)\.slides/);
  for (const appId of [
    "pages", "sheets", "slides", "notes", "database",
    "forms", "lists", "planner", "todo", "loop"
  ]) {
    assert.ok(app.includes(appId), `Missing print support for ${appId}`);
  }
  assert.match(app, /brightdesk-print-root/);
  assert.match(css, /#brightdesk-print-root/);
  assert.match(css, /data-app=["']slides["']/);
});


test("the current Forms view exposes its available printable question content", () => {
  const html = read("src/index.html");
  const app = read("src/app.js");
  for (const id of [
    "forms-wrap",
    "forms-questions-panel",
    "forms-title",
    "forms-description",
    "forms-question-list",
    "forms-add-question-form"
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /forms:\s*"forms-wrap"/);
  assert.match(app, /createBrightdeskPrintDocument/);
});


test("keeps discovered network printer addresses and service URIs out of product records", async () => {
  const { createHash } = await import("node:crypto");
  const { discoverNetworkPrinterServices } = await import(
    "../src/printing-package/src/ipp-printer-discovery.mjs"
  );

  for (const [serviceUri, address] of [
    ["ipp://192.168.10.24:631/ipp/print", "192.168.10.24"],
    ["ipps://[2001:db8::25]:631/ipp/print", "2001:db8::25"]
  ]) {
    const printers = await discoverNetworkPrinterServices({
      platform: "linux",
      async runCommand() {
        return { stdout: `${serviceUri}\\n` };
      }
    });

    const expectedId = `dns-sd:${createHash("sha256").update(serviceUri, "utf8").digest("hex")}`;
    assert.deepEqual(printers, [{
      id: expectedId,
      displayName: "Network printer",
      source: "dns-sd",
      availability: "discovered",
      canPrint: false
    }]);
    assert.equal(Object.hasOwn(printers[0], "uri"), false);
    assert.equal(JSON.stringify(printers).includes(serviceUri), false);
    assert.equal(JSON.stringify(printers).includes(address), false);
  }
});

test("keeps friendly DNS-SD printer names without exposing their service URI", async () => {
  const { discoverNetworkPrinterServices } = await import(
    "../src/printing-package/src/ipp-printer-discovery.mjs"
  );
  const serviceUri = "ipp://Office-Laser.local:631/ipp/print";
  const printers = await discoverNetworkPrinterServices({
    platform: "linux",
    async runCommand() {
      return { stdout: `${serviceUri}\\n` };
    }
  });

  assert.equal(printers.length, 1);
  assert.equal(printers[0].displayName, "Office Laser");
  assert.match(printers[0].id, /^dns-sd:[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(printers[0], "uri"), false);
  assert.equal(JSON.stringify(printers).includes(serviceUri), false);
});
