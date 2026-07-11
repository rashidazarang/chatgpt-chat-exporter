# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT Chat Exporter is a browser-based tool for exporting ChatGPT and Google Gemini conversations to Markdown, HTML, or print-ready PDF. Pure JavaScript that runs in the browser console or as userscripts — no runtime dependencies.

## Architecture

**Single source of truth:** `src/extraction-engine.js`. Every shipped exporter is generated from it by `scripts/build-exporters.js`:

- `exporter-markdown.js`, `exporter-html.js`, `exporter-pdf.js` — ChatGPT console scripts
- `gemini-exporter-markdown.js` — Gemini console script
- `chatgpt-markdown-exporter.user.js`, `chatgpt-pdf-exporter.user.js` — userscripts with an export button

**Never edit the generated files directly.** Change the engine or the build script, then run `npm run build`. `npm test` fails if the generated files are stale.

Userscript `@version` headers come from `package.json`'s `version` field.

Legacy directories `core/` and `archived/` are historical prototypes; they are not part of the build.

### Engine design

- **Provider adapters** (`PROVIDERS`): per-platform selector cascades for messages, content roots, and titles, tried in priority order (data attributes → ARIA/custom elements → semantic HTML → class heuristics)
- **Content pipeline** (`serializeMessageContent`): clone the message, annotate `white-space: pre-wrap` regions from computed style, strip UI chrome, then process cards → code blocks → math → media → links → tables before serializing to Markdown or HTML
- **Verbatim protection**: code fences, display math, and pre-wrap prompt text bypass Markdown whitespace cleanup; pre-wrap text travels through collision-proof randomized placeholders (`MARKER_PREFIX`)
- **Fidelity rules**: never backslash-escape inside code spans or code fences; inline backtick collisions use longer CommonMark delimiters; table cells escape only `|`
- **Sender detection**: role attributes first, then class/aria hints, then content heuristics, alternating fallback last (`identifySender`)

## Development

```bash
npm install     # jsdom (tests only)
npm run build   # regenerate exporters from src/extraction-engine.js
npm test        # build --check + node --test (jsdom-based suite in test/)
```

Tests live in `test/exporters.test.js` with synthetic DOM fixtures (`test/fixtures/`) mirroring live-observed ChatGPT/Gemini shapes. Every bug fix gets a regression test. Note: jsdom lacks `innerText`; the engine intentionally avoids relying on it (it degrades to `textContent` on detached clones in real browsers too).

### Manual testing

1. Open a ChatGPT or Gemini conversation
2. DevTools Console (F12) → paste the built exporter file → Enter
3. Verify the downloaded export against the rendered conversation

### Selector updates

When ChatGPT/Gemini UI changes, update the provider's selector list in this priority order:
1. Data attributes (`[data-testid*="..."]`, `data-message-author-role`)
2. ARIA roles / custom elements (`user-query`, `model-response`)
3. Semantic HTML elements
4. Class-based selectors (least preferred)

## Release checklist

1. Bump `version` in `package.json`
2. `npm run build && npm test`
3. Update README (What's New, Version History) and add `temporal/release-notes-vX.Y.Z.md`
4. Commit, tag `vX.Y.Z`, push, create the GitHub release

## Important Notes

- Exports omit the exact conversation URL unless `includeSourceUrl: true` is passed
- HTML/PDF output escapes all conversation content; unsafe link schemes are dropped
- No private live captures may be committed (`private-research/` is gitignored)
