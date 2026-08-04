# Release Notes — v0.8.0

## Full captures for long conversations, exported references, native menus

### Lazy-loaded (virtualized) conversations export fully — issues #28, #29

ChatGPT windows long conversations: messages scrolled out of view are removed
from the DOM entirely. A single DOM pass therefore exported only the rendered
fragment, no matter how far the user scrolled beforehand (the DOM forgets what
was scrolled past).

The engine now ships an async full-extraction path (`extractConversationFull` /
`exportConversationFull`) that:

1. Finds the conversation's scroll container (first scrollable ancestor of a
   detected message, falling back to the document's scrolling element).
2. Pins to the top until the container stops growing, so providers that lazily
   prepend older history finish loading it.
3. Sweeps downward in overlapping steps (75% of the viewport at a time),
   capturing and serializing every message while its DOM nodes exist. Identity
   across snapshots comes from `data-message-id` when present, with a
   text-fingerprint fallback; content-hash dedupe collapses any stragglers.
4. Restores the original scroll position.

All console runners and both userscripts now export through this path. Static
pages (no scrollable container) behave exactly as before — verified by a
regression test asserting identical output.

### References list for web-search citations — issue #27

Citations in a response — recognized by ChatGPT's `utm_source=chatgpt.com`
tracking parameter or by citation/sources containers — are appended to that
message as a numbered **References** list, matching what ChatGPT's own copy
button produces. Works in Markdown (`**References:**` + numbered links), HTML,
and PDF (`<div class="references">` ordered list). Citations are collected
before UI-chrome stripping so pills rendered inside removable wrappers are
still seen; duplicates are collapsed by URL; numeric pill labels fall back to
the source hostname. Ordinary links are never promoted to references.

### Native menu integration — PR #26 (+ follow-up hardening)

Export actions now live in ChatGPT's native conversation (•••) and header
Share menus instead of floating buttons (thanks @iam-brain). Follow-up fixes
on top of the merged PR:

- **Locale-safe detection**: share controls are recognized by
  `data-testid*="share"` first, with the English "Share" text match kept only
  as a fallback — non-English ChatGPT locales get the export UI too.
- **Native Share preserved**: the replacement header menu now leads with a
  **Share…** item that re-opens ChatGPT's real share dialog (which creates
  share links server-side — something "Copy link" cannot replace).
- Userscript exports go through the new full-extraction path, so long
  conversations export completely from the menus as well.

### Dependencies

- undici bumped 7.28.0 → 7.29.0 (PR #30, Dependabot): high-severity cache
  poisoning/disclosure fixes plus several medium-severity header/cookie
  injection fixes. Dev-only (jsdom transitive).

## Tests

20/20 passing (`npm test`): 6 new regression tests covering virtualized-sweep
completeness and ordering, static-page parity, Markdown/HTML references,
native-share pass-through, and locale-independent share detection.
