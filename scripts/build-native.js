#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'rust','target','release');
const names={win32:'brightdesk_engine.dll',darwin:'libbrightdesk_engine.dylib',linux:'libbrightdesk_engine.so'};
if(!names[process.platform]){console.error('Unsupported operating system');process.exit(2);}
const r=spawnSync(process.platform==='win32'?'cargo.exe':'cargo',['build','--manifest-path',path.join(root,'rust','Cargo.toml'),'--workspace','--release'],{cwd:root,stdio:'inherit',shell:process.platform==='win32',env:process.env});
if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);
const src=path.join(out,names[process.platform]);if(!fs.existsSync(src)){console.error('Cargo did not produce '+src);process.exit(1);}
const dir=path.join(root,'native');fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,'brightdesk_engine.node');fs.copyFileSync(src,dest);console.log('Built '+dest);
