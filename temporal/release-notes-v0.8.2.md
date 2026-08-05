# Release Notes — v0.8.2

## Found by testing against a live ChatGPT conversation

Everything here was discovered by running the built userscript against a real
ChatGPT conversation in Chrome, not against test fixtures. Each fix ships with a
regression test that fails on v0.8.1 and passes now.

### Long exports came out in the wrong order — critical

Exporting a 12-turn conversation produced its turns in the order
**1, 2, 8, 9, 10, 11, 12, 3, 4, 5, 6, 7**.

The auto-scroll sweep appended messages in the order it captured them. When the
sweep jumped to the top, ChatGPT had not yet unmounted the turns from where the
reader was sitting — the bottom — so that very first capture picked up the last
turns and put them ahead of the middle of the conversation. This hit any
conversation long enough to be virtualized, exported from the bottom, which is
where anyone who has just finished reading a chat actually is.

Messages now carry their offset within the scroll content (`rect.top +
scrollTop`, stable across snapshots because the virtualizer preserves total
height) and are sorted into conversation order before rendering. Verified live:
the same sweep that produced `1,2,8,9,10,11,12,3,4,5,6,7` now yields
`1,2,3,4,5,6,7,8,9,10,11,12`. Providers that infer senders by alternation get
that inference redone in reading order after the sort.

### Sweeps could stop after the first screenful

One live export returned 6 of 12 turns. The downward sweep ended as soon as a
step failed to advance `scrollTop`, but a virtualizer swapping rendered turns
for shorter placeholders can drag `scrollTop` *backwards* mid-sweep, which the
old loop read as "bottom reached" and exported the fragment captured so far.

The sweep now judges progress by messages captured and by actually reaching the
bottom, tolerates several non-advancing steps before giving up, and takes one
final capture after the last step. The pin-to-top phase also waits for two
stable heights instead of one, so a virtualizer that pauses between batches
isn't mistaken for one that has finished.

### Export entries never appeared in the ••• menu on desktop

ChatGPT ships the conversation menu's **Share** row with `sm:hidden` — it is
hidden on wide viewports, where the header Share button takes over. v0.8.0 and
v0.8.1 cloned that row to build the export entries and skipped any menu whose
Share row wasn't visible, so on a desktop viewport the ••• menu never got export
items at all.

A Share row now qualifies a menu whether or not it renders, and the clone is
taken from a row that actually renders, so the entries are visible. They also
carry the right glyph: the clone keeps ChatGPT's own `<svg>` element (and its
sizing classes) with our icon path inside it.

### "Share prompt" on a message no longer opens our export menu

Every user turn carries its own `share-prompt-link-turn-action-button`. Our
header-share detection matched any button whose test id contains "share", so
clicking **Share prompt** on a message opened the export menu instead of sharing
that message. Buttons inside a conversation turn are now left alone, and a
turn-level share button no longer counts as "this account has sharing", which
would have suppressed the floating launcher.

### Sidebar conversation menus are left alone

A sidebar row's ••• menu belongs to a different conversation, but an export
always reads the conversation that is open — so those menus no longer get export
entries rather than offering to export the wrong chat.

## Verified live

Against a real 12-turn conversation, with the built userscript loaded in Chrome:

- header **Share** opens the export menu; **Share prompt** on a message stays
  native
- the ••• menu shows **Export to Markdown** / **Export to PDF**, and the entries
  are visible, carry no ChatGPT test ids, and export on click
- `ChatExporter.showLauncher()` mounts the floating **Export** button, whose menu
  offers Copy link / Markdown / PDF
- a Markdown export downloaded a 16.7 KB file containing all 12 turns, titled
  from the conversation, with no exact URL embedded

## Tests

36/36 passing (`npm test`), 6 new: conversation ordering with a stale tail,
sweeps against a backwards-jumping virtualizer, the hidden-Share desktop menu,
per-turn share buttons (both interception and launcher suppression), and sidebar
menus.
