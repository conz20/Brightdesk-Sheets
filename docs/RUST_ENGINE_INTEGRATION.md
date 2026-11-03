# Rust Node-API engine integration

This standalone product builds a shared Rust engine as a Node-API 8 native library, loaded directly by Electron's main process. Rust handles bounded source processing, embedding normalization, cosine similarity, and deterministic vector ranking. JavaScript retains application orchestration and provider selection.

An explicitly configured embedding provider can supply vectors through the provider-neutral JavaScript adapter. Rust normalizes and ranks those vectors; it does not generate semantic embeddings or call language models. No provider, credential, paid API, or remote source upload is enabled. Any remote provider requires separate approval for data handling, retention, and cost.

The generated `native/brightdesk_engine.node` is unpacked from ASAR and is not committed. The renderer never loads native code; the context-isolated preload exposes only a read-only capability query. Customer apps do not depend on Brightdesk-AI.

Use `npm run native:build`, `npm run rust:fmt`, `npm run rust:test`, and `npm run rust:check`. CI targets Linux, Windows, and macOS. This integration is not release-verified until all platform jobs pass.
