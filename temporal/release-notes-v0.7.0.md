# Release Notes - v0.7.0

## Summary

v0.7.0 rewrites ChatGPT and Gemini extraction around a shared provider-based engine. The work is informed by a local live Chrome/Crawlio compatibility audit of current `chatgpt.com` and `gemini.google.com/app` rendering. Raw authenticated captures remain private, ignored, and are not included in the repository.

## Highlights

- Added `src/extraction-engine.js` as the canonical extraction and serialization engine.
- Added `scripts/build-exporters.js` to embed the shared engine into all pasteable console scripts and ChatGPT userscripts.
- Updated ChatGPT discovery to prioritize `div[data-message-author-role]` and preserve current CodeMirror code blocks, tables, TeX annotations, media placeholders, and basic file/artifact cards.
- Updated Gemini discovery to prioritize current `user-query`, `model-response`, `message-content`, and custom `code-block` structures.
- Added synthetic live-shape fixtures for ChatGPT and Gemini that model observed DOM structures without publishing private capture data.
- Expanded `npm test` so it verifies generated scripts are current before running jsdom exporter coverage.

## Privacy Note

The local audit used authenticated Chrome and Crawlio Agent captures. Public repository artifacts contain only generalized findings, synthetic fixtures, docs, tests, and code.

## Validation

- `npm run build`
- `npm test`
