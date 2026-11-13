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
 for(const locale of ["en-AU","de-DE","es-ES","fr-FR"]){const pack=JSON.parse(read(\`src/languages/\${locale}.json\`));assert.ok(pack.translations["top.print"]);assert.ok(pack.translations["top.printerSettings"]);}
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
