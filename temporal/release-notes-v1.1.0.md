# v1.1.0 — GitHub becomes the install source, and three contributed fixes

## Why the version jumps from 0.12.1 to 1.1.0

The GreasyFork listing of the userscripts went stale at a version it published
as **1.0.0**, while active development continued here at 0.x. The result
(issue #34, reported by @jonasjancarik): the GreasyFork copy is broken, and a
user who tries to fix it by installing the working GitHub build is told by
Tampermonkey that it would be a *downgrade* — the worst possible framing for
the correct action.

Version numbers only have to move forward, so this release moves past the
stale one. From now on:

- **GitHub is the canonical install source.** The README recommends only the
  raw GitHub links.
- **The userscripts update themselves from GitHub.** Both now carry
  `@downloadURL` / `@updateURL` headers pointing at
  `https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/…`, plus
  `@homepageURL` / `@supportURL` for the repo and issue tracker.
- **A one-time reinstall is needed** for anyone on the GreasyFork copy —
  after that, updates flow automatically.

## Contributed fixes (all by @zvictor — thank you)

- **#35 — whitespace loss from non-citation references.** ChatGPT payloads can
  contain bookkeeping `content_references` whose `matched_text` is a single
  space and which carry no URL. The citation resolver treated that as an
  unresolved marker and removed *every space in the answer*. Whitespace-only
  markers are now ignored, with a regression test taken from the observed
  export.
- **#36 — ChatGPT exports use the tab title.** Answer bodies can contain
  ordinary `<h1>` elements, so treating the first mounted heading as
  conversation metadata produced unstable titles such as "Final architecture".
  ChatGPT now prefers `document.title`, matching what Gemini already did.
- **#37 — reasoning progress folds into its final answer.** Reasoning models
  store the updates shown in the "Worked for…" disclosure as consecutive
  assistant/text records. Only the last record before the next user turn is the
  visible answer; the preceding progress now renders as a labelled `<small>`
  block immediately before it. Console scripts expose `INCLUDE_REASONING`
  (default `true`) to omit it.

## Security/quality

- **Citation markers strip in linear time.** CodeQL flagged the lazy
  `[\s\S]*?` in `PAYLOAD_CITATION_MARKER` as polynomial: a payload full of
  unclosed U+E200 code points made every starting position rescan to the end.
  Markers never nest, so the inner match now excludes the delimiters —
  identical on real input, linear on hostile input.
