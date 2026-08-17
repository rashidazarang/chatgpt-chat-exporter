# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT Chat Exporter is a browser-based tool for exporting ChatGPT and Google Gemini conversations to Markdown, HTML, or print-ready PDF. Pure JavaScript that runs in the browser console or as userscripts — no runtime dependencies.

## Architecture

**Single source of truth:** `src/extraction-engine.js`. Every shipped exporter is generated from it by `scripts/build-exporters.js`:

- `exporter-markdown.js`, `exporter-html.js`, `exporter-pdf.js` — ChatGPT console scripts
- `gemini-exporter-markdown.js` — Gemini console script
- `selector-doctor.js` — console health check for either provider's selector cascade
- `src/userscript-ui.js` — native ChatGPT conversation-menu and Share-menu integration
- `chatgpt-markdown-exporter.user.js`, `chatgpt-pdf-exporter.user.js` — generated userscripts with Markdown and PDF menu actions

**Never edit the generated files directly.** Change the engine or the build script, then run `npm run build`. `npm test` fails if the generated files are stale.

Userscript `@version` headers come from `package.json`'s `version` field.

Legacy directories `core/` and `archived/` are historical prototypes; they are not part of the build.

### Engine design

- **Provider adapters** (`PROVIDERS`): per-platform selector cascades for messages, content roots, and titles, tried in priority order (data attributes → ARIA/custom elements → semantic HTML → class heuristics)
- **A turn is a provider concept, not a ChatGPT one** (`turnSelector`, `messageScope`): the wrapper that owns a message *and whatever renders beside it* differs per platform, so each provider declares its own and `messageScope` takes the provider. It must wrap **exactly one message**. Gemini's own `div.conversation-container` wraps a *pair* — one `user-query` plus one `model-response` — and adopting it would hand both to `selectContentRoot`, which ranks candidates by text length: the pair wins, every answer gets prefixed with its own question, and both messages collapse to one `messageKey` so the second is dropped as already seen. Gemini's turn *is* its message element
- **The title cascade misses on both live providers** (verified 2026-08-17): every `titleSelectors` entry returns nothing on real ChatGPT and Gemini pages, so `document.title` is the actual source. Gemini stamps `" - Google Gemini"` on it, which reached the exported title and the filename verbatim — hence `documentTitleSuffix`. Do not "fix" this by loosening the selectors: on Gemini, `[class*="title"]` matches sidebar chrome ("Notebooks", "New notebook") and would export that as the conversation title. `filenameFor` takes the already-cleaned `conversation.title`, never `doc.title`
- **`diagnose()` / `selector-doctor.js`**: a paste-into-the-console health check generated from this engine, so it reports on the selectors that actually ship. It flags the dangerous case — a cascade still working, but only on a late fallback entry, which is what silent drift looks like one release before it breaks
- **Content pipeline** (`serializeMessageContent`): clone the message, annotate `white-space: pre-wrap` regions from computed style, strip UI chrome, then process cards → code blocks → math → media → links → tables before serializing to Markdown or HTML
- **Verbatim protection**: code fences, display math, and pre-wrap prompt text bypass Markdown whitespace cleanup; pre-wrap text travels through collision-proof randomized placeholders (`MARKER_PREFIX`)
- **Fidelity rules**: never backslash-escape inside code spans or code fences; inline backtick collisions use longer CommonMark delimiters; table cells escape only `|`
- **Sender detection**: role attributes first, then class/aria hints, then content heuristics, alternating fallback last (`identifySender`)
- **Detect streaming by behaviour, not by selector** (`awaitStreamingSettled`): watch whether the newest message keeps growing. A "stop generating" test id changes with every redesign; "the last message is still getting longer" is true of any streaming provider
- **Dedupe on whole content, never a prefix** (`contentHash`): a conversation of redrafts opens every answer the same way, and a prefix key silently drops all but the first
- **An incomplete sweep must announce itself** (`conversation.complete` / `missedMessages`): a short file that looks whole is the worst outcome. The sweep also runs against a wall-clock deadline (`maxDuration`) and restores scroll position in a `finally`
- **A turn is not readable the moment it mounts**: the virtualizer renders the container before the text. Never retire a message key until `captureMessage` reports success, track the selector's *candidates* (`findMessageCandidates`) since `isValidMessage` hides empty shells, and re-capture in place after another delay — never with a return trip, because ChatGPT snaps back to the newest message when scrolled up, so an upward pass never reaches the top
- **A hidden tab cannot be swept**: Chrome throttles timers and suspends off-screen rendering, so exports come out short. The engine warns; testing must be done with the tab visible or the results are meaningless
- **Capture order is not conversation order** (`sortByConversationOrder`): the sweep sees messages in whatever order the virtualizer mounts them — a capture taken at the top still sees the bottom turns ChatGPT hasn't unmounted yet. Every message records `rect.top + container.scrollTop` and the list is sorted by it before rendering. Never append-and-ship from a sweep
- **Virtualized conversations** (`extractConversationFull`): ChatGPT drops off-screen messages from the DOM, so the async path scrolls the conversation container top-to-bottom, serializing each message while it exists (keys: `data-message-id`, then text fingerprint; content-hash dedupe). All runners and userscripts export through it; pass `scroll: false` or no scrollable container to get the single-pass behavior
- **Citations** (`collectCitations`): links with `utm_source=chatgpt.com` or inside citation/sources containers are collected before UI stripping and appended per-message as a numbered References list (issue #27)
- **A refusal is not always a 4xx you recognize** (`isChatGptAuthFailure`, `fetchChatGptJson`): chatgpt.com's private API rejects cookie-only requests and reports it as **404 `conversation_inaccessible`** — the same status a deleted conversation returns — so a retry keyed on 401/403 never fires. Read the token from `/api/auth/session` *up front* and send it on every `/backend-api/*` call rather than retrying after a failure: the request that would 404 is then never made, which is the only way to keep the error out of the reader's console. Escalate only on refusal — refresh the token, then try each `ChatGPT-Account-Id` from `accounts/check` (a workspace owns its members' conversations). Never escalate on a 404 *without* an auth code; that conversation really is gone
- **Credentials stop at the origin**: `/backend-api/files/download/*` answers with a signed link to a third-party CDN. Attaching the bearer token to that hop would hand the reader's ChatGPT session to another host — authenticate same-origin only (`isSameOrigin`). That endpoint also reports failure as **HTTP 200** with `{"status":"error",…}`, so `response.ok` proves nothing
- **Turn-level attachments and metadata**: ChatGPT can render an image/file beside an empty `data-message-author-role` node, so validation and content selection inspect the enclosing `conversation-turn-*` wrapper. The async path then makes a bounded best-effort read of the current conversation payload to add message timestamps, attachment names/bytes, generated sandbox links, and user-visible `reasoning_recap` content; the whole enrichment pass is capped at 15s and failure must never block the DOM export (issues #32, #33)
- **Raster media only**: safe PNG/JPEG/GIF/WebP/AVIF/BMP data may be embedded; SVG data is never embedded. Per-image and total byte caps protect the browser, with HTTPS URLs/placeholders as fallbacks

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

Before blaming the exporter — or before trusting a fixture — paste
`selector-doctor.js` into the same console. It reports what each shipped
selector matches on that page, which one is carrying it, whether the title came
from a selector or the tab, and (on ChatGPT) whether the private API
authenticates. The full report is left on `window.ChatExporterReport`.

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

### Live Gemini DOM notes (observed 2026-08-17, desktop Chrome)

Verified against a real signed-in conversation. Re-check before trusting it:

- Messages are `user-query` / `model-response` custom elements — the first
  entry of the cascade, still healthy. Every other entry
  (`[data-test-id="conversation-turn"]`, `[data-message-author-role]`,
  `[role="listitem"]`, …) matches **nothing**; they are dead weight kept as
  insurance
- Content roots `message-content`, `.query-text`, `.response-container` all
  match, one per turn
- `div.conversation-container` wraps **a question and its answer together** —
  never use it as the turn scope (see the engine-design note above)
- The scroll container is `infinite-scroller.chat-history`
  (`overflow-y: scroll`), found at depth 2 from a message
- **No per-message timestamps exist in the DOM** (`time[datetime]` and friends:
  zero matches) — and Gemini has no private-API path, so Gemini exports carry
  no timestamps at all. ChatGPT's also has none; its timestamps come entirely
  from the conversation payload, which is why the metadata 404 meant *every*
  ChatGPT export shipped without them
- All `img` elements sit outside the message elements (avatars, product
  chrome), so media serialization does not pick them up
- The tab title is `"<conversation name> - Google Gemini"`

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
