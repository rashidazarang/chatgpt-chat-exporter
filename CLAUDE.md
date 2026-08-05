# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT Chat Exporter is a browser-based tool for exporting ChatGPT and Google Gemini conversations to Markdown, HTML, or print-ready PDF. Pure JavaScript that runs in the browser console or as userscripts — no runtime dependencies.

## Architecture

**Single source of truth:** `src/extraction-engine.js`. Every shipped exporter is generated from it by `scripts/build-exporters.js`:

- `exporter-markdown.js`, `exporter-html.js`, `exporter-pdf.js` — ChatGPT console scripts
- `gemini-exporter-markdown.js` — Gemini console script
- `src/userscript-ui.js` — native ChatGPT conversation-menu and Share-menu integration
- `chatgpt-markdown-exporter.user.js`, `chatgpt-pdf-exporter.user.js` — generated userscripts with Markdown and PDF menu actions

**Never edit the generated files directly.** Change the engine or the build script, then run `npm run build`. `npm test` fails if the generated files are stale.

Userscript `@version` headers come from `package.json`'s `version` field.

Legacy directories `core/` and `archived/` are historical prototypes; they are not part of the build.

### Engine design

- **Provider adapters** (`PROVIDERS`): per-platform selector cascades for messages, content roots, and titles, tried in priority order (data attributes → ARIA/custom elements → semantic HTML → class heuristics)
- **Content pipeline** (`serializeMessageContent`): clone the message, annotate `white-space: pre-wrap` regions from computed style, strip UI chrome, then process cards → code blocks → math → media → links → tables before serializing to Markdown or HTML
- **Verbatim protection**: code fences, display math, and pre-wrap prompt text bypass Markdown whitespace cleanup; pre-wrap text travels through collision-proof randomized placeholders (`MARKER_PREFIX`)
- **Fidelity rules**: never backslash-escape inside code spans or code fences; inline backtick collisions use longer CommonMark delimiters; table cells escape only `|`
- **Sender detection**: role attributes first, then class/aria hints, then content heuristics, alternating fallback last (`identifySender`)
- **Capture order is not conversation order** (`sortByConversationOrder`): the sweep sees messages in whatever order the virtualizer mounts them — a capture taken at the top still sees the bottom turns ChatGPT hasn't unmounted yet. Every message records `rect.top + container.scrollTop` and the list is sorted by it before rendering. Never append-and-ship from a sweep
- **Virtualized conversations** (`extractConversationFull`): ChatGPT drops off-screen messages from the DOM, so the async path scrolls the conversation container top-to-bottom, serializing each message while it exists (keys: `data-message-id`, then text fingerprint; content-hash dedupe). All runners and userscripts export through it; pass `scroll: false` or no scrollable container to get the single-pass behavior
- **Citations** (`collectCitations`): links with `utm_source=chatgpt.com` or inside citation/sources containers are collected before UI stripping and appended per-message as a numbered References list (issue #27)

### Userscript UI design (`src/userscript-ui.js`)

- **Never depend on a ChatGPT affordance for the only entry point.** Native menu integration is an enhancement; the floating launcher (`syncLauncher`) is the guarantee — enterprise policies can remove Share entirely (issue #31). The launcher mounts only when no share control is visible *and* the page has messages, and hides itself when one appears
- **No HTML injection sinks.** ChatGPT deployments can enforce Trusted Types, which makes `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` throw. Build nodes with DOM APIs; parse SVG icons with `DOMParser` + `importNode` (`renderIcon`). A test runs the built userscript with every sink throwing
- **Only extend menus that already offer a whole-conversation action** (`findMenuTemplate` requires a Share item). Sidebar per-conversation menus reach the same code and would export the *open* conversation, not theirs
- **Watch for observer feedback loops**: writing an unchanged attribute still queues a mutation record, so style updates are diffed first (`setLauncherVisible`)
- Cloned native items are stripped of `id`/`data-testid`/`data-test-id` (including descendants) so ChatGPT's own queries never match our copies
- `window.ChatExporter` (`markdown()`, `pdf()`, `showLauncher()`) is the documented console fallback for bug reports

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

### Live ChatGPT DOM notes (observed 2026-08-05, desktop Chrome)

Verified by running the built userscript against a real conversation. Re-check
before trusting any of it — but do not assume a fixture reflects these:

- Header: `button[data-testid="share-chat-button"]` and
  `button[data-testid="conversation-options-button"]` inside
  `div[data-testid="thread-header-right-actions"]`
- ••• menu: `div[role="menu"][data-radix-menu-content]`, items are
  `div[role="menuitem"].__menu-item` with an `svg.icon` (no `viewBox`).
  Its Share row (`data-testid="share-chat-menu-item"`) carries **`sm:hidden`** —
  `display:none` on desktop, so never require it to be *visible*
- Every user turn carries `button[data-testid="share-prompt-link-turn-action-button"]`
  ("Share prompt"), which shares that message, not the conversation
- Turns are `section[data-testid="conversation-turn-N"]`; N is the ground truth
  for conversation order and is **not contiguous** in the DOM (virtualized)
- Messages have `data-message-id`; the scroll container is the first scrollable
  ancestor and keeps a constant `scrollHeight` while turns are swapped
- CSP: `script-src` has no `'unsafe-eval'`, `connect-src` blocks localhost, and
  framing localhost is blocked — a userscript manager is the only sane way to
  load the exporter; for ad-hoc testing, CDP-evaluated *synchronous* `eval`
  works but anything after an `await` is subject to page CSP

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
