# Rust engine integration

This standalone Brightdesk product vendors the Rust engine source and builds it locally, without requiring access to the private Brightdesk-AI repository. Rust provides bounded source chunking, lightweight source analysis and deterministic lexical feature vectors through a JSON Lines process interface. The Node.js application remains the orchestration layer; the bridge includes a timeout and a clear missing-binary error so JavaScript fallback behavior can remain available.

Run `npm run rust:check` for formatting, Clippy, Rust tests and a release build. CI targets Linux, Windows and macOS. No compiled binary is committed.

The 384-dimensional vectors are lexical features, **not semantic embeddings**. No external model provider or remote embedding service is enabled. Future adapters must be opt-in and must not upload customer documents or private source without explicit approval. Brightdesk-AI remains private and is not included in customer installers.
