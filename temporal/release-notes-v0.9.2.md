# Release Notes — v0.9.2

## Image-only turns are no longer lost (#33)

ChatGPT places uploaded media beside the element carrying
`data-message-author-role`. An image-only prompt therefore looked like an empty
message to the old validator: it was retried until the sweep ended, omitted,
and reported as a turn that never finished rendering.

Validation, serialization, ordering, and stable identity now use the enclosing
`conversation-turn-*` wrapper. Safe raster images are embedded as data URLs
when their bytes are available. If embedding is not possible, the exporter
keeps an HTTPS source or an explicit placeholder rather than dropping the turn.
SVG data is deliberately excluded, and embedding is bounded to 20 MB per image
and 50 MB per export.

## Transcript context is preserved (#32)

The async ChatGPT path now performs a bounded, best-effort read of the current
conversation payload with the browser's existing signed-in session. It uses
that payload to add:

- a localized timestamp to each matched user and assistant turn;
- uploaded attachment filenames and image bytes;
- generated `sandbox:/mnt/data/...` file references; and
- user-visible `reasoning_recap` text.

Raw hidden `thoughts` content is not exported. Message ids are matched first;
positional fallback is allowed only when the payload and DOM contain the same
number of visible messages, preventing metadata from being attached to the
wrong turn in an incomplete capture.

File cards are also processed before generic interface buttons are removed, so
button-only upload controls and linked generated-file cards retain their label
and target.

Each metadata request times out after five seconds by default, and the whole
enrichment pass is capped at 15 seconds and the export's existing deadline. It
is strictly an enhancement: authentication failures, endpoint changes, expired
file links, or oversized images never prevent the normal DOM export.

## Tests

51/51 passing (`npm test`). New regressions cover an image-only upload outside
the role node, embedded Markdown and HTML images, button-backed uploaded files,
generated sandbox links, per-turn timestamp rendering, authenticated image-byte
enrichment, visible reasoning recaps, and a stalled metadata endpoint that must
yield to its wall-clock budget without blocking the DOM export.
