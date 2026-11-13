'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'src','app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'src','index.html'),'utf8');
const catalog=require('../src/app-catalog');
const english=require('../src/languages/en-AU.json').translations;
test('all six additional apps have dedicated integrated workspace renderers',()=>{for(const [id,hook] of [['todo','renderTodoWorkspace'],['lists','renderListsWorkspace'],['forms','BrightdeskFormsUI.render'],['planner','BrightdeskPlannerUI.render'],['database','BrightdeskDatabaseUI.render'],['loop','BrightdeskWorkspaceUI.render']]){assert.ok(app.includes(hook),id+' renderer');assert.ok(html.includes('id="'+(id==='loop'?'workspace-app-wrap':id+'-wrap')+'"'),id+' markup');}});
test('the integrated app shell loads every feature module before app.js',()=>{const names=['todo-service.js','lists-service.js','forms-service.js','forms-workspace.js','planner-service.js','planner-workspace.js','database-service.js','database-workspace.js','workspace-service.js','workspace-editor.js'];for(const name of names)assert.ok(html.indexOf('src="'+name+'"')>=0,name+' is loaded');const main=html.indexOf('src="app.js"');for(const name of names)assert.ok(html.indexOf('src="'+name+'"')<main,name+' loads before app shell');});
test('the fixed product catalogue remains exactly ten approved apps',()=>{assert.deepEqual(catalog.map(x=>x.id),['pages','sheets','slides','notes','database','forms','lists','planner','todo','loop']);assert.equal(catalog.length,10);for(const id of ['outlook','onedrive','teams'])assert.equal(catalog.some(x=>x.id===id),false);});
test('all ten approved apps are available in the integrated suite',()=>{assert.ok(catalog.every(x=>x.availability==='available'),'every approved app must be marked available once its implementation is integrated');});
test('the app shell routes each app away from the generic editor',()=>{for(const id of ['todo','lists','forms','planner','database','loop'])assert.ok(app.includes("state.app === '"+id+"'")||app.includes("state.app==='")+id+"'",id+' routing');});

test('product navigation follows the saved installation selection',()=>{
  const match=app.match(/function installedApp\(id\) \{[^}]*\}/);
  assert.ok(match,'installedApp helper exists');
  const isInstalled=vm.runInNewContext(match[0]+'; installedApp',{state:{installedApps:['pages','lists']}});
  assert.equal(isInstalled('pages'),true);
  assert.equal(isInstalled('lists'),true);
  for(const id of ['todo','forms','planner','database','loop']) assert.equal(isInstalled(id),false, id+' should follow saved selection');
});


test('product centre uses approved Brightdesk desktop wording',()=>{
  assert.equal(english['manager.eyebrow'],'BRIGHTDESK PRODUCT CENTRE');
  assert.equal(english['manager.chooseTitle'],'Choose the products you need');
  assert.equal(english['manager.manageTitle'],'Manage your products');
  assert.equal(english['manager.installSelected'],'Add selected products');
  assert.equal(english['sidebar.getApps'],'Get products');
  assert.doesNotMatch(app,/Download standalone|standalone installer/i);
  assert.doesNotMatch(html,/YOUR APPS|Get apps|Desktop app|Back to apps/i);
  assert.doesNotMatch(app,/Keep at least one app installed|Choose at least one app to install|Desktop app ·/i);
});

test('provides a safe external link to Brightdesk Help from the sidebar',()=>{
  const helpUrl='https://help.brightdesk.com/products/sheets.html';
  const pageHtml=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','index.html'),'utf8');
  const mainSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','main.js'),'utf8');
  const helpIcon=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','src','assets','icons','help.svg'),'utf8');
  const sidebarStart=pageHtml.indexOf('<aside class="sidebar">');
  const sidebarEnd=pageHtml.indexOf('</aside>',sidebarStart);
  const linkStart=pageHtml.indexOf('<a class="nav help-nav" id="help-link"',sidebarStart);
  const linkEnd=pageHtml.indexOf('</a>',linkStart);
  assert.notEqual(sidebarStart,-1,'application sidebar exists');
  assert.ok(linkStart>sidebarStart&&linkStart<sidebarEnd,'Help is in the persistent application sidebar');
  assert.notEqual(linkEnd,-1,'Help link is complete');
  const link=pageHtml.slice(linkStart,linkEnd+4);
  assert.ok(link.includes('href="'+helpUrl+'"'),'Help opens the matching product guide');
  assert.ok(link.includes('target="_blank"')&&link.includes('rel="noopener noreferrer"'),'Help opens safely outside the product');
  assert.ok(link.includes('<b>Help</b>')&&link.includes('Guides and how-to'),'Help has a discreet, clear label');
  assert.ok(link.includes('src="assets/icons/help.svg"'),'Help uses the shared original SVG icon');
  assert.match(helpIcon, /<svg\b/);
  assert.match(helpIcon, /viewBox="0 0 24 24"/);
  assert.ok(!pageHtml.slice(pageHtml.indexOf('<header class="topbar">'),pageHtml.indexOf('</header>')).includes('id="help-link"'),'Help is not duplicated in the top bar');
  assert.ok(mainSource.includes("target.origin !== 'https://help.brightdesk.com'"),'external navigation is restricted to the approved Brightdesk Help domain');
  assert.ok(mainSource.includes("!allowedBrightdeskHelpPaths.has(target.pathname)"),'external navigation is restricted to this product guide only');
  assert.ok(mainSource.includes('target.search || target.hash'),'unexpected query strings and fragments are rejected');
  assert.ok(mainSource.includes('shell.openExternal(target.href)'),'approved Help navigation opens in the system browser');
});
