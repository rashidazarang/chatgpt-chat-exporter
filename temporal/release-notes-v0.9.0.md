# Release Notes — v0.9.0

An audit pass over the whole engine, not just the paths touched by the v0.8.x
fixes. Two of these were silent data loss.

## Messages that share a long opening are no longer collapsed — silent data loss

Deduplication keyed on the first 160 characters of a serialized message. Any two
turns that opened the same way counted as duplicates and the later one was
dropped from the export without a word. A conversation of redrafts — every
answer starting with the same letterhead, quote, or preamble — could lose most
of its answers.

Messages are now keyed by a hash over their whole text plus its length. Exact
duplicates still collapse, as intended; different messages that merely start
alike are both kept.

## Truncated exports announce themselves

A sweep that could not read every turn used to save a short file that looked
complete. The conversation now carries `complete` and `missedMessages`, the
console explains what was missed, and the export puts a dialog in front of the
reader rather than letting a partial file pass for the real thing.

## An export cannot hang the page

The sweep had no wall-clock bound: a provider whose container kept changing
height could hold the page for minutes across the step budget. Every phase now
runs against one deadline (`maxDuration`, default 120s), and hitting it marks
the export incomplete instead of pretending otherwise.

## A backgrounded tab is waited for, not fought

Chrome throttles timers and suspends off-screen rendering in a hidden tab, so a
sweep there crawls and the provider never mounts the turns being scrolled to —
which is how several short exports happened during v0.8.x testing. The sweep now
pauses while the tab is hidden and resumes when it comes back, within the same
deadline. v0.8.3 only warned.

## The reader's scroll position always comes back

Restoring the scroll position was the last statement of the sweep, so anything
throwing midway — a client-side navigation swapping the thread out, for
instance — left the reader parked wherever the sweep had got to. It now happens
in a `finally`, and a container that disappears mid-sweep is re-resolved rather
than written to uselessly.

## Interface

- The launcher shows **Exporting…** while a sweep runs, and a second click no
  longer starts a competing sweep fighting the first for the scroll position.

## Hardening

- `isUnsafeHref` now strips whitespace and control characters before testing the
  scheme. Browsers ignore them inside a scheme, so `java&#9;script:` reads as
  `javascript:`. The resolved `link.href` already normalised this away, so this
  closes the raw-attribute fallback path rather than a live hole.

## Tests

44/44 passing (`npm test`), 7 new. Five fail against v0.8.3; the href one is
defence in depth and passes either way.
