import test from "node:test";
import assert from "node:assert/strict";
import printingIpc from "../src/printing-ipc.cjs";
const {registerPrintingIpcHandlers}=printingIpc;
function harness(authorized=true){
 const handlers=new Map();let adapterRequests=0;
 const adapter={
  listPrinters:async()=>[{systemName:"Virtual_Printer"}],
  discoverNetworkPrinters:async()=>[],
  pairNetworkPrinter:async printer=>({status:"paired",printer}),
  getPrinterCapabilities:async name=>({systemName:name}),
  openPrinterSettings:async()=>({status:"opened"}),
  print:async request=>({status:"submitted",requestedPrinterName:request.printerName??null})
 };
 registerPrintingIpcHandlers({handle:(name,fn)=>handlers.set(name,fn)},{isAuthorizedSender:()=>authorized,getAdapter:async()=>{adapterRequests++;return adapter;}});
 return {handlers,get adapterRequests(){return adapterRequests;}};
}
test("registers the six printing operations",()=>{const {handlers}=harness();assert.deepEqual([...handlers.keys()].sort(),["printing:discover-network-printers","printing:get-capabilities","printing:list-printers","printing:open-settings","printing:pair-network-printer","printing:print"]);});
test("rejects unauthorized calls before creating an adapter",async()=>{const h=harness(false);await assert.rejects(h.handlers.get("printing:list-printers")({sender:{}}),/Invalid sender/);await assert.rejects(h.handlers.get("printing:print")({sender:{}},{}),/Invalid sender/);assert.equal(h.adapterRequests,0);});
test("forwards calls from authorized windows",async()=>{const h=harness();const event={sender:{}};const p={id:"wsd:virtual"};assert.deepEqual(await h.handlers.get("printing:list-printers")(event),[{systemName:"Virtual_Printer"}]);assert.deepEqual(await h.handlers.get("printing:discover-network-printers")(event),[]);assert.deepEqual(await h.handlers.get("printing:pair-network-printer")(event,p),{status:"paired",printer:p});assert.deepEqual(await h.handlers.get("printing:get-capabilities")(event,"Virtual_Printer"),{systemName:"Virtual_Printer"});assert.deepEqual(await h.handlers.get("printing:open-settings")(event),{status:"opened"});assert.deepEqual(await h.handlers.get("printing:print")(event,{printerName:"Virtual_Printer"}),{status:"submitted",requestedPrinterName:"Virtual_Printer"});assert.equal(h.adapterRequests,6);});
