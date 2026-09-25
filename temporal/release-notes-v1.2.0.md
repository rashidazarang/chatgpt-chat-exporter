# v1.2.0 — ChatGPT's new page layout, complete long chats, bookmarklets

## ChatGPT's new page layout

ChatGPT has begun serving a second transcript layout (verified live on
2026-09-25, logged out; which accounts get it is not yet known). Each turn is
an `li[data-message-role]` in an `ol[data-conversation-transcript]`, class
names are atomic, the prompt sits inside a `<button data-user-message-bubble>`,
and web sources are buttons carrying their links as JSON. The previous build
matched no message there: exports came out empty, and the userscript never
showed its **Export** button. Now:

- turns are found, their role and message id are read from the `li`, and the
  "You said:" labels, action rows, copy controls and popovers are stripped by
  their data attributes;
- buttons that wrap message content (the prompt bubble, image previews) are
  unwrapped instead of deleted, and other buttons are removed as before;
- sources become inline links plus a numbered **References** list, and
  non-HTTP(S) targets are dropped;
- display math inside the new `span.katex` wrapper exports as `$$…$$`;
- a per-message **Share** stays ChatGPT's own, and the launcher appears.

## Fixes

- **#43 — short messages were skipped in temporary chats.** Two causes: turns
  under five characters failed a minimum-length check, and on the new layout
  the prompt was deleted with the button around it. Every non-empty turn is
  exported, including "Hi", "OK" and 👍.
- **#40 — images were missing from temporary chats.** A clickable image
  preview was stripped along with its button. Media inside buttons is kept.
- **#41 — long conversations fell back to an incomplete scroll.** The primary
  read of ChatGPT's stored conversation gets a 60-second request timeout and a
  120-second budget; optional attachments, reports and images keep their
  separate short budgets, and existing explicit overrides still work. HTML and
  PDF exports, which scroll the page, now read the stored conversation with
  the same budget afterwards — even when the sweep ran out of time — to check
  the capture and render any turn it missed. A turn that was on screen but
  never became readable is filled the same way.
- **Gemini answers were flattened.** Gemini styles its whole answer
  `white-space: pre-wrap`, and the exporter treated that as typed text, so
  headings, lists and bold came out plain. Only an unstructured top-level
  pre-wrap region is read verbatim now. Code fences also get their real
  language instead of the first line of code.
- **Deep Research reports** are exported from app widget state, compatible
  metadata carriers, legacy async results, direct research results and
  completed task streams, with bounded reads. A report followed by an
  assistant summary keeps both; a report that cannot be read marks the export
  incomplete, with a notice inside the saved file. Based on @zvictor's
  contribution in PR #38 — thank you. Its review items are addressed: report
  JSON is parsed once per message, the report-frame probe matches the frame's
  source as well as its title, JSON and stream reads share one authentication
  routine, and a missing task stream is tested.
- **Fidelity:** code keeps consecutive blank lines; one blank line (not two)
  precedes a code fence; repeated turns are preserved by identity while
  duplicate copies of one message collapse; the site's tagline ("ChatGPT: …")
  and "Google Gemini" are no longer used as export titles.

## Bookmarklets (#39)

Self-contained bookmarklets for ChatGPT Markdown, HTML and PDF-ready export and
Gemini Markdown, generated from the console bundles with pinned Terser. Copy
a [bookmarklet file](https://github.com/rashidazarang/chatgpt-chat-exporter/tree/master/public/bookmarklets)
into a new bookmark's URL, or drag the links from `public/bookmarklets/index.html`.
No remote executable is loaded, so a bookmark does not update itself. Each is
over 100,000 characters: Chromium-based browsers store it, but Firefox rejects
bookmark URLs longer than 65,536 characters — use the userscript or console
there.

## Hardening

- Timeouts cover response bodies as well as headers, so a stalled JSON, image
  or Deep Research stream cannot hang an export.
- Authenticated requests refuse redirects; signed CDN image reads carry no
  credentials or referrer; streamed images are size-capped while reading, and
  DOM and downloaded images share one byte budget and a canvas pixel limit.
- A stored conversation with broken or cyclic ancestry, or an unfinished
  response, marks the export incomplete instead of mixing branches.
- Exported HTML carries a restrictive Content-Security-Policy and a
  no-referrer policy.
- Generated-file links trim trailing punctuation in linear time; the regex
  it replaces was quadratic on a long punctuation run (CodeQL
  js/polynomial-redos).
- UI icons are built with SVG DOM APIs, so strict Trusted Types policies need
  no parser.
- Development requires Node 22.22.2+, 24.15.0+ or 26+ (browser users need no
  Node). CI runs Node 22/24/26 and 78 Chromium/Firefox/WebKit checks with
  pinned actions; `npm run release:prepare` builds checksummed artifacts.

## Compatibility notes

HTML/PDF remain page-first. Text recovered from the stored conversation is
escaped and readable, but plain — it does not recreate the page's formatting
or a research report's iframe layout. Temporary chats have no stored copy, so
there the page is the only source. The checks still outstanding need a
signed-in ChatGPT account; they are listed in
[RELEASE_AUDIT.md](../docs/RELEASE_AUDIT.md#remaining-live-checks).
