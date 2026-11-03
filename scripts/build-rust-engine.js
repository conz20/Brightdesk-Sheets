'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),manifest=path.join(root,'rust','Cargo.toml'),exe=process.platform==='win32'?'brightdesk-rust-engine.exe':'brightdesk-rust-engine',built=path.join(root,'rust','target','release',exe),dir=path.join(root,'native'),out=path.join(dir,exe);
const r=spawnSync('cargo',['build','--manifest-path',manifest,'--release','--bin','brightdesk-rust-engine'],{cwd:root,stdio:'inherit',env:process.env,shell:process.platform==='win32'});
if(r.error){console.error(r.error.message);process.exit(1);}if(r.status!==0)process.exit(r.status||1);if(!fs.existsSync(built)){console.error('Rust engine output missing: '+built);process.exit(1);}fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(built,out);if(process.platform!=='win32')fs.chmodSync(out,0o755);console.log('Built '+path.relative(root,out));
