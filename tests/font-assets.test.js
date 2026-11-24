'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p));
const text = p => read(p).toString('utf8');
test('loads Inter variable faces locally without a network font service',()=>{
 const html=text('src/index.html'),css=text('src/fonts.css');
 assert.match(html,/href="fonts\.css"/);
 assert.match(css,/font-family:\s*"Inter"/);
 assert.match(css,/font-weight:\s*100\s+900/);
 assert.match(css,/font-style:\s*normal/); assert.match(css,/font-style:\s*italic/);
 assert.match(css,/font-optical-sizing:\s*auto/);
 assert.match(css,/url\("\.\/assets\/fonts\/inter\/Inter\[opsz,wght\]\.ttf"\)/);
 assert.match(css,/url\("\.\/assets\/fonts\/inter\/Inter-Italic\[opsz,wght\]\.ttf"\)/);
 assert.doesNotMatch(css,/https?:\/\//);
});
test('includes valid Inter font binaries and the complete OFL licence',()=>{
 for(const p of ['src/assets/fonts/inter/Inter[opsz,wght].ttf','src/assets/fonts/inter/Inter-Italic[opsz,wght].ttf']){
  const b=read(p); assert.deepEqual([...b.subarray(0,4)],[0,1,0,0]); assert.ok(b.byteLength>800000);
 }
 assert.match(text('src/licenses/fonts/inter-OFL.txt'),/^Copyright 2020 The Inter Project Authors/);
 assert.match(text('src/licenses/fonts/inter-OFL.txt'),/SIL OPEN FONT LICENSE Version 1\.1/);
 assert.match(text('src/licenses/fonts/README.md'),/Inter 4\.1/);
});
