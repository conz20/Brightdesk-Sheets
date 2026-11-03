import test from "node:test";import assert from "node:assert/strict";import{engineInfo,normalizeEmbedding,cosineSimilarity,rankEmbeddings,chunkSource,analyzeSource}from"../scripts/rust-engine.mjs";
test("Node-API engine reports capabilities",()=>{const i=engineInfo();assert.equal(i.engine,"Brightdesk Rust Native Engine");assert.equal(i.nodeApiVersion,8);assert.ok(i.capabilities.includes("vector-ranking"));});
test("normalizes vectors and rejects invalid values",()=>{const v=normalizeEmbedding([3,4]);assert.ok(Math.abs(v[0]-0.6)<1e-10);assert.throws(()=>normalizeEmbedding([0,0]),/non-zero/i);});
test("computes cosine similarity and stable ranking",()=>{assert.equal(cosineSimilarity([1,0],[2,0]),1);assert.deepEqual(rankEmbeddings([1,0],[[0,1],[1,0],[2,0]]).map(x=>x.index),[1,2,0]);});
test("chunks Unicode and analyses source",()=>{const s="🦀".repeat(100),c=chunkSource(s,128);assert.ok(c.every(x=>Buffer.byteLength(x)<=128));assert.equal(c.join(""),s);assert.equal(analyzeSource("one two\nthree").tokenCount,3);});

import fallbackModule from "../src/rust-engine-fallback.js";
const { createJavaScriptFallback } = fallbackModule;

test("JavaScript fallback matches the native engine's core contract", () => {
  const fallback = createJavaScriptFallback();
  const info = fallback.engineInfo();
  assert.equal(info.engine, "Brightdesk JavaScript Fallback");
  assert.equal(info.native, false);
  assert.equal(info.nodeApiVersion, 0);
  assert.deepEqual(fallback.analyzeSource("one two\\nthree"), {
    bytes: 13,
    lines: 2,
    tokenCount: 3
  });
  assert.deepEqual(fallback.normalizeEmbedding([3, 4]), [0.6, 0.8]);
  assert.equal(fallback.cosineSimilarity([1, 0], [2, 0]), 1);
  assert.deepEqual(
    fallback.rankEmbeddings([1, 0], [[0, 1], [1, 0], [2, 0]]).map(item => item.index),
    [1, 2, 0]
  );
});

test("JavaScript fallback chunks Unicode within the byte limit", () => {
  const fallback = createJavaScriptFallback();
  const source = "🦀".repeat(100);
  const chunks = fallback.chunkSource(source, 128);
  assert.ok(chunks.every(chunk => Buffer.byteLength(chunk) <= 128));
  assert.equal(chunks.join(""), source);
});

test("JavaScript fallback rejects unsafe vector and chunk inputs", () => {
  const fallback = createJavaScriptFallback();
  assert.throws(() => fallback.normalizeEmbedding([0, 0]), /non-zero/i);
  assert.throws(() => fallback.normalizeEmbedding([Number.NaN]), /finite/i);
  assert.throws(() => fallback.cosineSimilarity([1], [1, 2]), /matching dimensions/i);
  assert.throws(() => fallback.chunkSource("text", 64), /between 128 and 16000/i);
});
