'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/rust-engine');
const {createJavaScriptFallback}=require('../src/rust-engine-fallback');
test('engine metadata identifies native mode or compatible fallback',()=>{const info=engine.engineInfo();assert.equal(typeof info.engine,'string');assert.ok(info.native===true||info.fallback===true);if(process.env.BRIGHTDESK_REQUIRE_NATIVE_ENGINE==='1'){assert.equal(info.native,true);assert.equal(info.nodeApiVersion,8);}});
test('fallback validates and normalizes vectors',()=>{const f=createJavaScriptFallback();assert.deepEqual(f.normalizeEmbedding([3,4]),[0.6,0.8]);assert.equal(f.cosineSimilarity([1,0],[2,0]),1);assert.throws(()=>f.normalizeEmbedding([0,0]),/non-zero/i);assert.throws(()=>f.normalizeEmbedding([Number.NaN]),/finite/i);});
test('fallback ranks vectors deterministically',()=>{const f=createJavaScriptFallback();assert.deepEqual(f.rankEmbeddings([1,0],[[0,1],[1,0],[2,0]]).map(x=>x.index),[1,2,0]);});
test('fallback preserves Unicode source within byte limits',()=>{const f=createJavaScriptFallback();const source='🦀'.repeat(100);const chunks=f.chunkSource(source,128);assert.ok(chunks.every(c=>Buffer.byteLength(c,'utf8')<=128));assert.equal(chunks.join(''),source);assert.deepEqual(f.analyzeSource('one two\nthree'),{bytes:13,lines:2,tokenCount:3});});
