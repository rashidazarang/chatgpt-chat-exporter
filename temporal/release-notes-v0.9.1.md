# Release Notes — v0.9.1

## Exporting mid-answer no longer captures a half-written reply

Hit Export while ChatGPT is still writing and the export contained the answer as
it stood at that instant — cut off mid-sentence, with nothing to say it was
partial.

The sweep now waits for the newest message to stop growing before it reads
anything. That is deliberately behavioural rather than a hunt for a "stop
generating" button: a test id changes with every redesign, whereas "the last
message is still getting longer" is true of any provider that streams. An idle
conversation pays a single 250 ms check; a streaming one waits for the answer,
bounded by the same `maxDuration` deadline as the rest of the sweep. If the
deadline arrives first, the export is marked incomplete and says so rather than
passing off a truncated answer as the whole thing.

Pass `awaitStreaming: false` to skip the check.

## Gemini's sweep is covered

The Gemini exporter has gone through the same auto-scroll path since v0.8.0, but
nothing tested it — Gemini marks conversations up as `user-query` /
`model-response` custom elements with no message ids, so it exercises the
identity fallback that ChatGPT never touches. A virtualized Gemini thread is now
part of the suite: every turn captured, in order, with the right senders. No bug
found — this closes a coverage gap that could have hidden one.

## Tests

47/47 passing (`npm test`), 3 new. The two streaming tests fail against v0.9.0;
the Gemini one is coverage of existing behaviour.

Also in this release: the test harness now waits for a download to appear rather
than assuming a fixed number of event-loop ticks, so timing changes in the
engine can't quietly turn the end-to-end tests into no-ops.
