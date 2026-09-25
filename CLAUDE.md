# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT Chat Exporter is a browser-based tool for exporting ChatGPT and Google Gemini conversations to Markdown, HTML, or print-ready PDF. Pure JavaScript that runs in the browser console or as userscripts — no runtime dependencies.

## Architecture

**Single source of truth:** `src/extraction-engine.js`. Every shipped exporter is generated from it by `scripts/build-exporters.js`:

- `exporter-markdown.js`, `exporter-html.js`, `exporter-pdf.js` — ChatGPT console scripts
- `gemini-exporter-markdown.js` — Gemini console script
- `selector-doctor.js` — console health check for either provider's selector cascade
- `src/progress-overlay.js` — the in-page progress card, bundled into every console runner and userscript
- `src/userscript-ui.js` — native ChatGPT conversation-menu and Share-menu integration
- `chatgpt-markdown-exporter.user.js`, `chatgpt-pdf-exporter.user.js` — generated userscripts with Markdown and PDF menu actions

**Never edit the generated files directly.** Change the engine or the build script, then run `npm run build`. `npm test` fails if the generated files are stale.

Userscript `@version` headers come from `package.json`'s `version` field.

Reference docs live in `docs/`. The former `core/` and `archived/` prototype directories were removed in v0.12.0; they are in git history if ever needed.

### Source of truth per format

**Markdown from ChatGPT reads the payload; everything else reads the DOM.**

The payload *is* the markdown the model produced — the DOM is a rendering of it.
Scraping the rendering and then repairing the result from the source we could
have read directly is what produced seven of the eight defects fixed in
v0.9.3–v0.11.0. `canUsePayloadSource` gates it; any failure falls through to the
sweep unchanged, and the fetched payload is handed along so it is never
requested twice.

The inversion is Markdown-only on purpose: HTML and PDF need rendered HTML,
which the DOM provides natively and the payload would need a markdown parser to
produce. Payload-first also needs **no sweep at all** — no scrolling, no
virtualizer, no hidden-tab stall.

- **Citation markers are private-use code points**: `U+E200 cite U+E202 turn1search0 U+E201`. Write the range as an **escaped** `[\uE200-\uE20F]`; with literal characters the class can collapse into one that also matches `-`, silently turning `grep-based` into `grepbased` across an entire export. `metadata.content_references[].items[]` carries the real title and URL — better than the DOM, where the same citation is a pill labelled "W3C+1"
- **Some answers are `tool` records** (`isToolMediaMessage`, `mainPayloadMessages(entries, true)`): ChatGPT stores a generated image, and a chart from code execution (`execution_output` with `metadata.aggregate_result.messages[].image_url`), as a tool reply — usually beside a hidden copy (`is_visually_hidden_from_conversation`) and followed by an empty assistant reply. Payload-first rendering exports the visible image-bearing tool record as the assistant's answer and drops the empty reply; a real 142-message export had lost 24 answers this way. The page path keeps the narrower selection because it matches page turns by id, and which id ChatGPT puts on an image turn is unverified
- **A message addressed to a tool is never content** (`recipient` other than `all`): tool calls — code, searches, image prompts, and redaction notices such as "This code was redacted." — reached exports as "Reasoning / progress"
- **Read a file id after the pointer's scheme** (`payloadAttachmentDescriptors`): `sediment://file_…` (newer uploads, every generated image) and `file-service://file-…`. Searching the whole pointer took "file-service" for an id — a bogus `[Image: file-service]` beside every such upload — and found nothing in the underscore form
- **Image time grows with the image count** (`attachmentDeadline`, `attachmentRequestTimeout`): one fixed 15-second budget embedded 7 of 48 images in a real export. Defaults are 15 s plus 3 s per image, capped at 180 s, with 15 s per download; `attachmentMaxDuration` / `attachmentFetchTimeout` override, and explicit `metadataMaxDuration` / `metadataFetchTimeout` still bound them. Key an image by its file id, never its name — names repeat
- **`payloadContentText` returns `''` for a multimodal part**: an image-only turn has its content in attachments, so callers must allow an empty body rather than dropping the message

### Engine design

- **Provider adapters** (`PROVIDERS`): per-platform selector cascades for messages, content roots, and titles, tried in priority order (data attributes → ARIA/custom elements → semantic HTML → class heuristics)
- **ChatGPT serves two transcript generations at once** (verified live 2026-09-25): role-tagged `div[data-message-author-role]` turns, and an `ol[data-conversation-transcript]` of `li[data-message-role]` items whose class names are atomic (meaningless). Both are one cascade entry, so neither reads as drift in the doctor. On the second, the message id is the `li`'s own `id` (`providerMessageId`), and chrome is only recognizable by data attributes — `[data-message-attribution]` ("You said:"), `[data-message-actions]`, `[data-message-content-controls]`, `[popover]`. Never strip it by atomic class
- **A button can hold the message** (`removeUiElements`): the second generation wraps every prompt in `<button data-user-message-bubble>`, and uploaded images are clickable previews. Stripping every button deleted "Hi" outright (issue #43) and images (issue #40). Buttons that wrap content (paragraphs, lists, tables, the bubble) are unwrapped; media-only buttons keep their media; everything else is removed
- **Sources can be buttons, not links** (`sourceReferenceItems`, `processSourceReferences`): the second generation carries each source's targets as JSON in `data-assistant-sources-payload`. They feed the References list in document order and become inline links; the trailing `sources_footnote` control is dropped. Only HTTP(S) targets survive
- **Pre-wrap is evidence of typed text only at the top of a region with no rendered structure** (`isVerbatimTextElement`): Gemini styles its whole answer `white-space: pre-wrap`, and reading that verbatim flattened every heading, list and bold run (verified live 2026-09-25). Descendants inherit pre-wrap, so a span beside a `<b>` must serialize normally too
- **A turn is a provider concept, not a ChatGPT one** (`turnSelector`, `messageScope`): the wrapper that owns a message *and whatever renders beside it* differs per platform, so each provider declares its own and `messageScope` takes the provider. It must wrap **exactly one message**. Gemini's own `div.conversation-container` wraps a *pair* — one `user-query` plus one `model-response` — and adopting it would hand both to `selectContentRoot`, which ranks candidates by text length: the pair wins, every answer gets prefixed with its own question, and both messages collapse to one `messageKey` so the second is dropped as already seen. Gemini's turn *is* its message element
- **The title cascade is a liability on Gemini, not an asset** (verified live 2026-08-17): `document.title` is the real source on both providers, and Gemini stamps `" - Google Gemini"` on it — hence `documentTitleSuffix`. Gemini also mounts its **model picker** under a class matching `[class*="conversation-title"]`, *lazily*: a first probe saw nothing and v0.9.4 shipped believing the cascade was inert, then the selector won and exported a conversation titled **"Flash-Lite"**. That selector is now gone from Gemini and `preferDocumentTitle` puts the tab ahead of any guess. Two rules follow: **never loosen a title selector** (`[class*="title"]` also matches Gemini's sidebar — "Notebooks"), and **never conclude a selector is inert from one point-in-time probe** — page chrome mounts late. `filenameFor` takes the already-cleaned `conversation.title`, never `doc.title`
- **`diagnose()` / `selector-doctor.js`**: a paste-into-the-console health check generated from this engine, so it reports on the selectors that actually ship. It flags the dangerous case — a cascade still working, but only on a late fallback entry, which is what silent drift looks like one release before it breaks
- **Content pipeline** (`serializeMessageContent`): clone the message, annotate `white-space: pre-wrap` regions from computed style, strip UI chrome, then process cards → code blocks → math → media → links → tables before serializing to Markdown or HTML
- **Verbatim protection**: code fences, display math, and pre-wrap prompt text bypass Markdown whitespace cleanup; pre-wrap text travels through collision-proof randomized placeholders (`MARKER_PREFIX`)
- **Fidelity rules**: never backslash-escape inside code spans or code fences; inline backtick collisions use longer CommonMark delimiters; table cells escape only `|`
- **Sender detection**: role attributes first, then class/aria hints, then content heuristics, alternating fallback last (`identifySender`)
- **Detect streaming by behaviour, not by selector** (`awaitStreamingSettled`): watch whether the newest message keeps growing. A "stop generating" test id changes with every redesign; "the last message is still getting longer" is true of any streaming provider
- **Deduplicate by identity, never by content** (`messageKey`): preserve separately identified or separately positioned repeated turns. Use message ids, numbered turn ids, measurable scroller position plus role, then DOM-node identity. Anonymous virtualizers that shift turn positions remain heuristic; never reintroduce content-only or prefix deduplication.
- **Waiting on the reader is not the export spending its budget** (`awaitVisible`): the hidden-tab wait used to run `while (doc.hidden && !outOfTime())`, so a backgrounded tab burned the whole `maxDuration` doing nothing and then saved whatever happened to be mounted. Worse, raising `maxDuration` to help a long conversation just bought a longer stall. The wait now draws on its own `maxHiddenWait` budget and **adds the time back to the deadline**. A sweep that runs for minutes must also *say* so (`PROGRESS_INTERVAL`) — silence is indistinguishable from a hang, which is how a working export gets abandoned
- **Wait for the DOM to settle, not for a fixed guess** (`awaitRenderSettled`): the sweep slept `scrollDelay` per step whether or not the virtualizer had already rendered, which on a long conversation is most of the export's wall clock. A MutationObserver on the scroll container resolves as soon as it has been quiet for `RENDER_QUIET_INTERVAL`, capped at the old delay — so it can only be faster, never less thorough. Measured 3.9× on a 40-message virtualized fixture with identical output. **The top-pinning loop deliberately keeps the fixed sleep**: it waits on a *network* fetch of older history, which produces no mutation until it lands, so settling on quiet would declare "no more history" after 60ms and start the sweep below the real top
- **Gemini renders KaTeX with `.katex-html` alone** — no `.katex-mathml`, no `<annotation>`, no MathML — and keeps the TeX in **`data-math` on the wrapper *around* the render** (`div.math-block` for display, `span` for inline). Two consequences: `data-math` must be in the attribute list *and* in `MATH_ROOT_SELECTOR` (the source-carrying node is the parent, not the `.katex`), and `isDisplayMath` must look **down** for `.katex-display` as well as up. Verified live: 42 formulas, 42 recovered
- **Never remove a visual duplicate that is the only copy**: de-duplication is only safe when an accessible representation survives it. v0.11.0 removed `.katex-html` whenever no TeX was found, which on Gemini would have deleted every formula in the export instead of de-duplicating anything
- **Every math renderer hides its TeX somewhere else, and every one emits a visual duplicate** (`processMath`, `texFromNode`): look for `annotation`/`annotation-xml` with a tex encoding, then `data-latex`/`data-tex`/`data-formula`, then a MathJax v2 `script[type^="math/tex"]`. When no source exists, **delete the visual copy** (`.katex-html`, `aria-hidden` inside `mjx-container`) — serializing both is how a formula becomes `f(x)f(x)`. `removeUiElements` must not strip `script[type^="math/tex"]`: it runs first, and stripping it left the MathJax v2 branch as dead code for as long as it existed
- **Regenerating or editing a turn leaves the old one in the mapping as a sibling branch** (`payloadVariantMessages`): `activePayloadMessages` walks only the branch on screen, so those versions are invisible to the export. `includeVariants: true` appends them, labelled, next to the turn that replaced them. **Off by default** — silently adding alternates would change the shape of every existing user's file. When variants exist the export says how many and how to get them
- **Code keeps every newline its text holds** (`collectCodeText`): collapsing runs of blank lines turned the two between Python definitions into one. Line elements (a `div` per line) end a line exactly once. A code header is never the code itself — Gemini marks its `<code>` `data-test-id="code-content"`, and taking that as the header made `print("hello")` the fence language; its real header is `.code-block-decoration`
- **Display math can be marked on either side of the TeX** (`isDisplayMath`): ChatGPT's second generation nests native MathML in `span.katex`, so the TeX-carrying root is the span while `display="block"` sits on the `math` below it and `[data-assistant-math-rendered="display"]` above
- **Media is serialized before links, so link text already contains our own markdown** (`markdownLink`): escaping it produced `[!\[Image\](data:image/png;base64,…)Label](url)` — not a link, a wall of base64 shown as text. ChatGPT's inline citations are exactly this shape (favicon + label in one `<a>`). Take the label and drop the media; keep the image, unescaped and properly nested, only when it is all the link has. HTML is unaffected — its media are opaque placeholders, so `<a><img></a>` already nests correctly
- **Screen-reader-only text is chrome, not content** (`removeUiElements`): ChatGPT labels every turn with `<h4 class="sr-only select-none">ChatGPT said:</h4>` — 1x1px, positioned off-screen, invisible to a reader — and it reached *every* exported message as a redundant `#### ChatGPT said:` heading. Strip by **class** (`sr-only`, `visually-hidden`, `cdk-visually-hidden`), never by text: a message whose own heading ends in "said:" is legitimate content
- **Finish the sweep at the bottom, however it ended**: the loop can `break` on stalls at any scroll position, and the final `capture()` used to run wherever that was. A real conversation stalled at 85% and shipped without its last two messages — the ones a reader notices first. The sweep now scrolls to the bottom before its last capture
- **The payload decides order and fills holes** (`alignWithPayload`): the sweep orders by `rect.top + scrollTop` measured *at capture time*, so a virtualizer that changes heights between captures can make two neighbours compare wrongly — a real export put an answer ahead of its own question. Where the payload chain covers every captured message it decides the order, and messages missing from the export are rendered from the payload rather than reported as a hole. Two rules: recovery is gated on payload entries **not represented in the export** — a turn the sweep saw but could never read is as absent as one it never reached, and duplicate DOM representations match one entry so they recover nothing — and reordering only applies when the payload accounts for **every** message, never half-rewriting an order it cannot explain
- **The stored conversation is read after a sweep with the primary budget** (`enrichChatGptConversation`): it is what proves an HTML/PDF export complete and fills its holes, and a long conversation is megabytes (issue #41). It runs even when the sweep ran out of `maxDuration`, and a payload that accounts for every turn makes the export complete regardless; only the attachments/reports that follow keep the short metadata budget
- **Ground truth beats a heuristic for completeness** (`expectedMessages` / `unreachedMessages`): a sweep that stops early captures every turn it *saw* cleanly, so `missedMessages` reads zero and the export claims to be complete. The ChatGPT payload knows the real message count. Compare the **ids the sweep encountered** against the payload's, never the counts — duplicate DOM representations and unsupported empty turns make count-only comparisons unreliable
- **Warnings and notes are different lists** (`diagnose`): anything that fires on a healthy page belongs in `notes`. Two warnings had to be demoted after they fired on correct behaviour — a title cascade missing on a provider that prefers the tab, and a virtualized conversation having more messages than are currently mounted. A warning list that cries wolf stops being read, which defeats the point of having one
- **An incomplete sweep must announce itself** (`conversation.complete` / `missedMessages`): a short file that looks whole is the worst outcome. The sweep also runs against a wall-clock deadline (`maxDuration`) and restores scroll position in a `finally`
- **A turn is not readable the moment it mounts**: the virtualizer renders the container before the text. Never retire a message key until `captureMessage` reports success, track the selector's *candidates* (`findMessageCandidates`) since `isValidMessage` hides empty shells, and re-capture in place after another delay — never with a return trip, because ChatGPT snaps back to the newest message when scrolled up, so an upward pass never reaches the top
- **A hidden tab cannot be swept**: Chrome throttles timers and suspends off-screen rendering, so exports come out short. The engine warns; testing must be done with the tab visible or the results are meaningless
- **Capture order is not conversation order** (`sortByConversationOrder`): the sweep sees messages in whatever order the virtualizer mounts them — a capture taken at the top still sees the bottom turns ChatGPT hasn't unmounted yet. Every message records `rect.top + container.scrollTop` and the list is sorted by it before rendering. Never append-and-ship from a sweep
- **Virtualized conversations** (`extractConversationFull`): ChatGPT drops off-screen messages from the DOM, so the async path scrolls the conversation container top-to-bottom, serializing each message while it exists (keys: message/turn ids, then scroller position plus role, then DOM-node identity). All runners and userscripts export through it; pass `scroll: false` or no scrollable container to get the single-pass behavior
- **Citations** (`collectCitations`): links with `utm_source=chatgpt.com` or inside citation/sources containers are collected before UI stripping and appended per-message as a numbered References list (issue #27)
- **A refusal is not always a 4xx you recognize** (`isChatGptAuthFailure`, `fetchChatGptJson`): chatgpt.com's private API rejects cookie-only requests and reports it as **404 `conversation_inaccessible`** — the same status a deleted conversation returns — so a retry keyed on 401/403 never fires. Read the token from `/api/auth/session` *up front* and send it on every `/backend-api/*` call rather than retrying after a failure: the request that would 404 is then never made, which is the only way to keep the error out of the reader's console. Escalate only on refusal — refresh the token, then try each `ChatGPT-Account-Id` from `accounts/check` (a workspace owns its members' conversations). Never escalate on a 404 *without* an auth code; that conversation really is gone
- **Credentials stop at the origin**: `/backend-api/files/download/*` answers with a signed link to a third-party CDN. Attaching the bearer token to that hop would hand the reader's ChatGPT session to another host — authenticate same-origin only (`isSameOrigin`). That endpoint also reports failure as **HTTP 200** with `{"status":"error",…}`, so `response.ok` proves nothing
- **Turn-level attachments and metadata**: ChatGPT can render an image/file beside an empty `data-message-author-role` node, so validation and content selection inspect the enclosing `conversation-turn-*` wrapper. The async path then makes a bounded best-effort read of the current conversation payload to add message timestamps, attachment names/bytes, generated sandbox links, and user-visible `reasoning_recap` content; the whole enrichment pass is capped at 15s and failure must never block the DOM export (issues #32, #33)
- **Raster media only**: safe PNG/JPEG/GIF/WebP/AVIF/BMP data may be embedded; SVG data is never embedded. Per-image and total byte caps protect the browser, with HTTPS URLs/placeholders as fallbacks

### Progress overlay design (`src/progress-overlay.js`)

- **The engine emits events; it never draws.** `options.onProgress` is a
  callback, so the engine stays usable headless in jsdom. A listener that throws
  is swallowed — a broken progress card must never cost the reader their export
- **Same Trusted-Types rule as the userscript UI**: nodes via
  `createElement`/`textContent`, styles set per-property. No `innerHTML`, and no
  injected stylesheet (`style-src` is a CSP surface too). A test builds the card
  with every HTML sink throwing
- **The card must not be exportable by the sweep watching it.** It is a direct
  child of `body` (outside the conversation container), carries no message
  markers, and is `position: fixed` so it cannot change the container's
  `scrollHeight` mid-sweep. `isValidMessage` also refuses anything inside
  `[data-chat-exporter-ui]` — belt and braces for the day someone moves it
- **`pointer-events: none`**: the reader must never have to fight it for a click
- **An incomplete export must not end on a green bar.** The `done` event carries
  `complete` / `unreachedMessages`, and the card turns amber and names the
  shortfall

### Userscript UI design (`src/userscript-ui.js`)

- **Never depend on a ChatGPT affordance for the only entry point.** Native menu integration is an enhancement; the floating launcher (`syncLauncher`) is the guarantee — enterprise policies can remove Share entirely (issue #31). The launcher mounts only when no share control is visible *and* the page has messages, and hides itself when one appears
- **No HTML injection sinks.** ChatGPT deployments can enforce Trusted Types, which makes `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` throw. Build nodes with DOM APIs; build fixed SVG geometry with `createElementNS` (`renderIcon`); `DOMParser.parseFromString` is also a Trusted Types sink. A test runs the built userscript with every sink throwing
- **Only extend menus that already offer a whole-conversation action** (`findMenuTemplate` requires a Share item). Sidebar per-conversation menus reach the same code and would export the *open* conversation, not theirs
- **Per-turn Share controls stay native** (`TURN_CONTAINER`): both transcript generations put a Share action on every message (`share-prompt-link-turn-action-button`, and an icon button in each `li[data-message-role]`); it shares that message, not the conversation
- **Watch for observer feedback loops**: writing an unchanged attribute still queues a mutation record, so style updates are diffed first (`setLauncherVisible`)
- Cloned native items are stripped of `id`/`data-testid`/`data-test-id` (including descendants) so ChatGPT's own queries never match our copies
- `window.ChatExporter` (`markdown()`, `pdf()`, `showLauncher()`) is the documented console fallback for bug reports

## Development

```bash
npm ci          # development dependencies only
npm run build   # regenerate exporters and self-contained bookmarklets
npm test        # exporter/bookmarklet freshness + node --test
npx playwright install --with-deps  # install browser test engines
npm run test:browser                # Chromium, Firefox, WebKit
```

Tests live in `test/` — `exporters.test.js` (engine, UI and runners), `hardening.test.js` (network, media and payload limits), `provider-dom.test.js` (live-observed page shapes) — with synthetic DOM fixtures (`test/fixtures/`) mirroring live-observed ChatGPT/Gemini shapes, plus the browser matrix in `browser-tests/`. Every bug fix gets a regression test. Note: jsdom lacks `innerText`; the engine intentionally avoids relying on it (it degrades to `textContent` on detached clones in real browsers too).

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

### Live ChatGPT DOM notes, second generation (observed 2026-09-25, logged out, desktop Chrome)

Seen on a logged-out chat (no stored copy, like a temporary chat); which
signed-in accounts get it is unverified. `test/fixtures/chatgpt-transcript-2026.html`
mirrors it:

- `ol[aria-label="Conversation"][data-conversation-transcript]` >
  `li[data-message-role="user"|"assistant"][id="<message uuid>"]`; assistant
  items also carry `data-message-complete` once finished
- Every `li` opens with `h4[data-message-attribution]` ("You said:"),
  visually hidden by atomic CSS, not by an `sr-only` class
- Prompts: `button[data-user-message-bubble] > p[data-user-message-copy]`, the
  `p` computing `white-space: pre-wrap`; the answer body
  (`div[data-assistant-markdown]`) is `white-space: normal`
- Code: `pre > code.language-<lang>[data-assistant-syntax-highlighted]` with a
  span per line and `\n` text nodes between them, plus
  `span[data-message-content-controls]` holding the copy button
- Math: `span[data-assistant-math-rendered="inline"|"display"] > span.katex >
  math` with an `application/x-tex` annotation; display math has
  `display="block"` on the `math`
- Sources: `button[data-assistant-sources-payload]` with a JSON array of
  `{attribution, title, url}`; `data-content-reference-type` is
  `grouped_webpages` on the enclosing span, `url` for inline links, and
  `sources_footnote` for the trailing "Sources" control
- The only `data-testid`s are app shells; the scroll container is
  `div[data-swipable-detail-body]` (`overflow-y: auto`)
- The logged-out tab title is the site tagline "ChatGPT: Chat, Work, Create &
  Code with AI"
- `document.hidden` is true whenever the window is not visible (for example a
  background automation window), so the sweep waits for it by design

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
- The tab title is `"<conversation name> - Google Gemini"` and is the only
  reliable source for it
- The model picker (e.g. "Flash-Lite") carries a class matching
  `[class*="conversation-title"]` and **mounts after first paint** — it is page
  chrome, not the conversation title
- The only `h1` is `h1.cdk-visually-hidden` reading "Conversation with Gemini"
- Re-checked 2026-09-25 in a temporary chat (tab title just "Google Gemini"):
  the answer's `div.markdown.markdown-main-panel` computes `white-space:
  pre-wrap`, inherited by every descendant; paragraphs are `p > span` with
  `<b>` as a sibling of the spans; code is `code-block` >
  `.code-block-decoration` ("Python") + `pre > code[data-test-id="code-content"]`
  with no `language` attribute; prompts are `.query-text > p.query-text-line`

### Selector updates

When ChatGPT/Gemini UI changes, update the provider's selector list in this priority order:
1. Data attributes (`[data-testid*="..."]`, `data-message-author-role`)
2. ARIA roles / custom elements (`user-query`, `model-response`)
3. Semantic HTML elements
4. Class-based selectors (least preferred)

## Release checklist

1. Bump `version` in `package.json` and `ENGINE_VERSION` in the source; update the lockfile (the build rejects mismatches)
2. `npm run build && npm test`
3. Update README (What's New, Version History) and add `temporal/release-notes-vX.Y.Z.md`
4. Commit, tag `vX.Y.Z`, push, create the GitHub release

## Important Notes

- Exports omit the exact conversation URL unless `includeSourceUrl: true` is passed
- HTML/PDF output escapes all conversation content; unsafe link schemes are dropped
- No private live captures may be committed (`private-research/` is gitignored)

## v1.2.0 release hardening

- Primary ChatGPT payload reads — Markdown's payload-first read and the read after an HTML/PDF sweep — have a 60-second request timeout and 120-second retrieval budget; optional metadata/report/image enrichment retains separate 5-second/15-second defaults. Legacy explicit metadata timeout overrides still work. `fetchWithTimeout` consumes the response body inside the deadline and races a timeout even if fetch ignores abort.
- Authenticated requests refuse redirects. Signed HTTPS image downloads omit credentials and referrers. Streamed image bytes are capped while reading.
- Unwrap buttons that hold message content before stripping UI. Non-empty short turns are valid content.
- Completed Deep Research reports survive a following assistant summary; missing reports mark the export incomplete. Incomplete notices persist inside saved files.
- `scripts/build-bookmarklets.js` generates `public/bookmarklets/` from the console bundles with pinned Terser. Do not edit the generated page or URL text files directly.
- `npm run release:prepare` prepares checksummed artifacts in ignored `dist/`; it does not publish. Read `docs/RELEASE_AUDIT.md` for outstanding live release checks.
