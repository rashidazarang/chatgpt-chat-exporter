# Release Notes — v0.9.4

A hardening pass over the provider layer, prompted by a simple question after
v0.9.3: the 404 fix was entirely ChatGPT-shaped — what about Gemini?

Both providers were read live (desktop Chrome, 2026-08-17). Gemini's primary
selectors turned out to be healthy; the defects were elsewhere.

## A turn is a provider concept now

`messageScope()` — the function that decides which element owns a message —
hardcoded ChatGPT's `conversation-turn` selector, and was called from seven
provider-agnostic functions: `isValidMessage`, `selectContentRoot`,
`messageKey`, `conversationOffset`, `providerMessageId`,
`extractMessageTimestamp`. On Gemini `.closest()` simply found nothing and fell
back to the element, so nothing was broken — but the entire turn-wrapper fix
from v0.9.2 (issues #32/#33: media rendered *beside* an empty role node) was
structurally unavailable to any provider but ChatGPT.

Each provider now declares its own `turnSelector` and `messageScope` takes the
provider.

**The correct value for Gemini is the message element itself**, and this is the
part worth remembering. Gemini has an obvious-looking wrapper —
`div.conversation-container` — but it holds a *pair*: one `user-query` and one
`model-response`. Adopting it would have handed both messages to
`selectContentRoot`, which ranks candidates by text length; the pair would win,
every answer would be prefixed with its own question, and both messages would
produce the same `messageKey` so the second would be dropped as already seen.
Verified against a live conversation: 5 containers, 10 messages, one of each per
container. A regression test now pins this.

## Gemini exports no longer carry Google's tab suffix

Every entry in Gemini's `titleSelectors` misses on the live site — as does
every entry in ChatGPT's. Both providers have been running on the
`document.title` fallback, which is fine for ChatGPT but not for Gemini, whose
tab reads `"<conversation name> - Google Gemini"`. That suffix reached the
exported `# Heading` and the download filename verbatim.

Providers now declare a `documentTitleSuffix` to strip. Loosening the selectors
would have been the wrong fix: on Gemini, `[class*="title"]` matches sidebar
chrome, and "Notebooks" would have been exported as the conversation title.

Separately, `filenameFor` read `doc.title` directly instead of the
already-cleaned `conversation.title`, so it reintroduced whatever the provider
stamps on the tab. It now takes the conversation title.

## selector-doctor.js

Provider markup drifts silently. A cascade keeps working on a late fallback
entry until one day nothing matches and it reaches a user as "No messages
found". Nothing in this repo could detect that state.

`selector-doctor.js` is a new generated console script — built from the same
engine as the exporters, so it can never report on selectors other than the ones
that ship. It prints what each selector actually matches, which one is carrying
the page, whether the title came from a selector or the tab, the scroll
container, and on ChatGPT whether the private API authenticates. It warns
specifically about the silent case: still working, but only on a fallback.

## What was checked and deliberately not changed

- **No Gemini metadata enrichment.** Gemini's web app speaks `batchexecute`
  RPC with obfuscated payloads, not ChatGPT's REST JSON. Symmetry is not worth
  taking on that as a maintenance target; the DOM path already carries the
  content.
- **Shared links** (`/share/<id>`) have no stored conversation to read. The
  exporter correctly asks for nothing rather than issuing a request that can
  only fail. Now covered by a test.
- **Project conversations** (`/g/g-p-.../c/<id>`) resolve to the right
  conversation id — the gizmo segment belongs to the page route. Now covered by
  a test.

## Note for ChatGPT users on v0.9.2 or earlier

Neither provider exposes per-message timestamps in the DOM; ChatGPT's come
entirely from the conversation payload. The v0.9.3 metadata 404 therefore meant
**every ChatGPT export shipped with no timestamps at all**, not merely reduced
metadata.

## Tests

64/64 passing (`npm test`), up from 57. New coverage: the Gemini pair-wrapper
trap, Gemini title/filename suffix stripping, ChatGPT's turn scope surviving the
refactor, project and share URL shapes, and the doctor itself — including a
drifted page where the preferred selector has stopped matching and the export
still succeeds. Both new provider behaviours were mutation-tested to confirm the
assertions actually fail without the fix.
