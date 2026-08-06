# Release Notes — v0.8.3

Follow-up to v0.8.2, from continued testing against a live ChatGPT conversation.

## Turns that mount before their text renders are no longer dropped

A virtualizer mounts a turn's container first and fills in the text a moment
later. The sweep marked every turn it looked at as "seen" *before* trying to
serialize it, so a turn caught mid-mount was retired permanently and simply
never appeared in the export.

Three parts to the fix:

- `captureMessage` now reports whether it captured anything, and the sweep only
  retires a turn once it has actually been serialized.
- Empty shells are invisible to `isValidMessage`, so the sweep tracks the
  message selector's *candidates* — every element the selector matches, ready or
  not — and remembers which ones it could not read yet.
- When a stop leaves anything unread, the sweep waits one more interval and
  looks again **at the same scroll position**, while those turns are still on
  screen. There is deliberately no return trip: ChatGPT snaps back to the newest
  message when you scroll up, so a second upward pass never reaches the top and
  hangs.

The selector is also resolved once and reused for the rest of the sweep. A whole
screenful can be mid-mount, and rediscovering the selector from that snapshot
would match nothing at all.

## A hidden tab is called out

Chrome throttles timers and suspends off-screen rendering in a background tab,
so the sweep crawls and the provider may never mount the turns being scrolled
to — the export comes out short through no fault of the page structure. Starting
a sweep on a hidden document now logs a warning telling you to bring the tab
forward. This was the cause of several truncated exports observed during
testing; it is a browser behaviour, not a bug in the extraction.

## Verified live

On a 12-turn conversation, with the built userscript loaded in Chrome and the
tab visible: 12/12 turns exported in 5.3 seconds, in conversation order, sizes
matching ChatGPT's own turn numbering 1→12. The same conversation exported as
`1, 2, 8, 9, 10, 11, 12, 3, 4, 5, 6, 7` on v0.8.1.

## Tests

37/37 passing (`npm test`), 1 new: a virtualized fixture whose turns mount empty
and fill in place a moment later, which fails on v0.8.2.
