# Release Notes — v0.12.0

ChatGPT Markdown exports now read the conversation from ChatGPT's own record
instead of scraping the page.

## Why

Of the eight defects fixed between v0.9.3 and v0.11.0, seven were artifacts of
reading a rendered, virtualized DOM: missing newest messages, an answer ahead of
its own question, `#### ChatGPT said:` on every turn, citations as walls of
base64, formulas exported twice.

The two messages *recovered from the payload* in v0.10.1 were cleaner than the
thirty scraped off the screen.

The reason is structural. **The payload is the markdown the model produced. The
DOM is a rendering of it.** The exporter was reconstructing a source document by
scraping its own rendering, then repairing the result from the source it could
have read directly.

## What changes

For **ChatGPT Markdown**, the exporter fetches the conversation and renders from
it. Consequences:

- **No scroll sweep.** No scrolling, no virtualizer, no hidden-tab stall, no
  wall-clock budget. One request instead of 30–60 seconds of scrolling.
- **Complete by construction.** "Messages the sweep never reached" cannot occur.
- **Better citations.** `content_references` carries each source's real title and
  URL. The DOM only had the pill label — "W3C+1" where the payload says
  "PROV-O: The PROV Ontology".
- **No scraping artifacts**, because nothing is scraped.

Everything else is unchanged and still reads the page: HTML and PDF (which need
rendered HTML), Gemini, shared links, temporary chats, signed-out sessions, and
any failure of the payload path. `sourceFromPayload: false` forces the old
behaviour.

Verified against the live 32-message conversation that drove this session:
identical message count, roles, timestamps, fenced blocks (98), tables (1) and
box-drawing characters (2440), 18/18 ground-truth content probes matched, zero
citation markers left, and citations carrying real titles.

## Two bugs found while building it

- **`payloadContentText` returned `''` for multimodal parts**, so an image-only
  turn rendered empty and was dropped. This already affected the v0.10.1
  recovery path.
- **The payload was fetched twice** when the payload path failed and fell back to
  the DOM. The fetched result — or the knowledge that there isn't one — is now
  handed along.

And one trap worth recording: ChatGPT's citation markers are private-use code
points (`U+E200 cite U+E202 turn1search0 U+E201`). The stripping range must be
written escaped. Written with literal characters it can collapse into a class
that also matches `-`, silently turning `grep-based` into `grepbased` throughout
an export — a corruption no structural check would catch. There is a test.

## Gemini

Audited against the live page for the first time. Gemini labels every turn with
`<span class="cdk-visually-hidden screen-reader-user-query-label">You said</span>`
— the same class of chrome as ChatGPT's `sr-only` heading, and already stripped
by the v0.10.2 fix. Verified end to end: exactly one such node per message, nine
or twelve characters removed, nothing else lost. Now pinned by a test built from
the real markup.

**Gemini has no payload**, so it has none of the guarantees above: no
timestamps, no completeness check, no recovery, no order correction. That
asymmetry is now stated in the README.

## Housekeeping

- `ISSUE_RESPONSES.md` and `EXPORTER_GUIDE.md` moved to `docs/`; the dead `core/`
  and `archived/` prototype directories removed. Root: 16 → 14 files. **The six
  exporter scripts stay where they are** — their raw URLs are the product, and
  GreasyFork auto-update follows them.
- The userscript launcher no longer says "Exporting…" while the progress card is
  already saying it better. The busy state that prevents a second concurrent
  sweep is untouched.

## Tests

99/99 passing, up from 92.
