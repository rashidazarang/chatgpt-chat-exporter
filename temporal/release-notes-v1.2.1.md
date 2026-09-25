# v1.2.1 — generated images, and every uploaded image

Found by auditing a real 142-message Markdown export made on 2026-09-25.
Markdown exports read ChatGPT's stored conversation, and four things in that
record were being lost or mislabelled.

## Fixes

- **Generated images were missing.** ChatGPT stores an image it generates —
  and a chart from code execution — as a `tool` reply, and the export skipped
  every tool reply. In the audited file, 18 requests had no answer at all and
  6 answers were a caption with nothing under it. Tool replies that carry
  images are now exported as ChatGPT's answer. The hidden copy ChatGPT keeps
  beside each image is still skipped, and the empty reply it stores after an
  image no longer counts as an answer.
- **Most uploaded images were placeholders.** Images shared one 15-second
  budget and were fetched one after another, so the first 7 of 48 were
  embedded and the other 41 became `[Image: …]` placeholders. The image budget
  now grows with the number of images — 15 seconds plus 3 per image, up to 3
  minutes — each download may take up to 15 seconds, and the progress card
  counts images as they are embedded. `attachmentMaxDuration` and
  `attachmentFetchTimeout` override the defaults; an explicit
  `metadataMaxDuration` or `metadataFetchTimeout` still applies.
- **Tool plumbing appeared as reasoning.** Messages ChatGPT addresses to a
  tool — code, a search, an image prompt — were folded into "Reasoning /
  progress", including redaction notices such as "This code was redacted."
  They are no longer exported.
- **Image pointers.** Newer uploads and every generated image point at
  `sediment://file_…`, which yielded no file id to download.
  `file-service://file-…` pointers yielded the id "file-service", which added
  a bogus `[Image: file-service]` beside the real image. Ids are now read
  after the scheme.
- **Images that share a name** — "Generated image", or two uploads called
  `image.png` — are all exported; the second used to be skipped as already
  present.
- **Earlier versions** (`includeVariants`) sit beside the turn they replaced
  even when an earlier turn renders nothing; they were paired by position.

## Scope

HTML and PDF exports read generated images from the page, as before. The
fixes follow the record shapes in the audited export and in a public,
sanitized capture of ChatGPT's image-generation records. Re-exporting the
audited conversation while signed in is the remaining live check; see
[RELEASE_AUDIT.md](../docs/RELEASE_AUDIT.md#remaining-live-checks).
