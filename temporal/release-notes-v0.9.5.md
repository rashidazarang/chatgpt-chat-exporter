# Release Notes — v0.9.5

A Gemini conversation could export titled **"Flash-Lite"** — the name of the
model, not the conversation. Found on the first real-world run of the
`selector-doctor.js` health check that v0.9.4 introduced.

## What happened

Gemini renders its model picker inside an element whose class matches
`[class*="conversation-title"]` — an entry in Gemini's own title cascade. When
it matched, it outranked `document.title`, which held the actual conversation
name. The exported `# Heading` and the download filename both became the model
name.

v0.9.4 shipped believing that selector was inert, because a live probe had shown
it matching nothing. **It mounts after first paint.** A single point-in-time DOM
read is not evidence that a selector is safe — page chrome arrives late.

## The fix

- `[class*="conversation-title"]` is **removed** from Gemini's cascade rather
  than merely outranked. A selector that can only produce a wrong answer is not
  insurance.
- Gemini gains `preferDocumentTitle`. Its tab title is the conversation name,
  verified live; no element in its DOM reliably carries it. A guessed selector
  no longer outranks a source known to be accurate.
- Title resolution is split into `documentTitleFor()` and `selectorTitleFor()`
  so the precedence is explicit and `diagnose()` can report on both.

Verified against the live conversation that exposed it: v0.9.4 produced
`"Flash-Lite"`, v0.9.5 produces `"Coordinación y Documentación de Reunión"`, and
the filename follows.

## The doctor now catches this class of bug

`diagnose()` reports `title.selectorCandidate` alongside the resolved value, and
warns when a title selector matched something the tab disagrees with:

> A title selector matched "GPT-5 Thinking" but the tab says "Migration
> Runbook" — one of them is page chrome.

That is precisely the signature of this bug, and it now fires before anyone
opens the exported file.

## A note on ChatGPT

ChatGPT keeps `[class*="conversation-title"]` in its cascade. On the live site it
matches nothing — there are no `[class*="title"]` elements on a conversation page
at all — and there is no evidence its tab title is the better source, so the bet
stands. The new doctor warning is what makes that bet visible if it ever goes
bad; a regression test pins the warning using exactly that scenario.

## Tests

66/66 passing (`npm test`), up from 64. New coverage: page chrome matching a
title selector cannot outrank the tab title, and the doctor warns when a
selector and the tab disagree.
