# Release Notes — v0.10.1

Two defects found by auditing a real 32-message export against ChatGPT's own
record of the same conversation. Both were silent: the file looked fine.

## The last two messages were missing

The export held 30 of 32. Not the oldest — the **newest two**, created over an
hour before the export ran, so this was not a race.

The sweep stalls when neither the scroll position nor the message count advances,
and gives up after five such steps. That can happen anywhere; this conversation
stalled at 85%. The final `capture()` then ran at whatever position the loop
happened to stop at, so the bottom of the conversation was never mounted and
never read.

The sweep now scrolls to the bottom before its last capture, however it ended.
The newest messages are the ones a reader notices are missing, and they were
always one scroll away.

## An answer appeared before the question that prompted it

Messages 24 and 25 came out swapped — same timestamp, wrong order.

Ordering uses `rect.top + scrollTop`, measured at the moment each message is
captured. A virtualizer that changes heights between two captures makes their
offsets incomparable, and two neighbours can sort wrongly.

The conversation payload holds the real order. Where it accounts for every
captured message, it now decides.

## Messages the sweep cannot reach are recovered, not reported as a hole

v0.9.6 taught the exporter to *notice* it had missed something. It could not do
anything about it: a message the sweep never reached is absent from the DOM, so
there is nothing left to re-read.

The payload has its text. Missing messages are now rendered from it and inserted
at their true position — markdown as-is for markdown exports, escaped for HTML.
Two guards:

- **Only ids the sweep never encountered.** A message that *was* seen and then
  collapsed by content dedupe was collapsed deliberately; re-adding it would
  undo that decision.
- **Reordering only when the payload explains every message.** If the DOM shows
  something the active chain omits, the payload is not a complete ordering and
  the sweep's own order stands rather than being half-rewritten.

Together these make a ChatGPT export complete whenever the private API is
reachable — which, since v0.9.3, it is. The progress card and the completion
dialog both say when messages were recovered.

## Tests

84/84 passing, up from 80. New: recovery fills unreached messages at the right
position with correct alternation; recovered text is escaped in HTML exports; a
pair captured out of order is corrected; payload order is *not* imposed when it
cannot account for every message; and the pre-existing dedupe and
incomplete-reporting guarantees still hold with recovery disabled. The ordering
fix is mutation-checked.
