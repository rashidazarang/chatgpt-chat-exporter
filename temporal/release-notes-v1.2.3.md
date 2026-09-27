# v1.2.3 — signed-in ChatGPT, tested live

Found by re-exporting the audited conversation while signed in, on
2026-09-27. It had grown to 164 messages, 24 of them generated images and 48
uploads, and kept growing during the tests.

## Markdown

- **Files a tool read back were exported as ChatGPT's replies.** When
  ChatGPT reads an uploaded file, it stores the file's pages as images plus an
  instruction to itself ("Make sure to include in your response to cite this
  file…"). v1.2.1's support for generated images exported those records as
  answers: four in the audited conversation. A generated image is a tool
  record with images and no text, and only those are answers now. Their
  images had also crowded the image budget: the same export now embeds all 72
  images, where v1.2.2 left 3 as placeholders.

## HTML and PDF, signed in

- **The signed-in page layout is supported.** Signed-in ChatGPT renders each
  prompt and answer as a unit keyed `…:user` / `…:assistant` inside a turn that
  holds both, and a generated image as a bare unit listing its record's id.
  The exporter recognised none of them. Every turn is exported now, attributed
  from its key or its "ChatGPT said:" label.
- **Long conversations were read from the wrong end.** The signed-in
  transcript scrolls in reverse, opening on the newest message, and loads
  older history only while the view is held at the top, in batches up to six
  seconds apart. The export started at the newest message believing it was the
  oldest, then took the first pause between batches for the start of the
  conversation. The audited conversation came out with 15 messages read from
  the page and 151 rebuilt from ChatGPT's stored record as plain paragraphs,
  with headings, lists and tables flattened. The export now climbs from the
  newest message and waits out each batch: 171 of 180 messages are read from
  the page, and the scroll takes 66 seconds.
- **Page images used up the image budget.** Images were redrawn through a
  canvas as PNG, which made a 1.7 MB generated image 2.3 MB. Twenty of them
  filled the 50 MB budget, and 44 images became placeholders. The page's own
  copy of each file is now embedded byte for byte, falling back to the stored
  file. 71 of 75 images are embedded; the other 4 are over the 50 MB cap.
- **An image gallery was exported twice over.** Its selected image appeared a
  second time from the thumbnail strip, and its other images were added again
  as extra ChatGPT turns. Each image now appears once, in its turn.
- **An uploaded image the page already showed** is no longer added a second
  time from the stored record.
- **False "incomplete" warnings.** Records that show nothing counted as
  messages the export was missing: the empty reply ChatGPT stores after a
  generated image, and a reply interrupted before any text was saved.
- **A reply interrupted before any text was saved** now leaves the same note
  as in Markdown, instead of two of your prompts in a row.
- **Faster scrolling.** A turn that never fills in, such as an interrupted
  reply's empty unit, made every later scroll step wait twice.

## Options

- `historyWait` (default 8000 ms): how long the export holds the top of a
  reverse-scrolling transcript waiting for older history before taking it for
  the start of the conversation.
- `maxScrollSteps` now defaults to 2000 (was 400). The `maxDuration` wall clock
  still bounds the scroll.

## Scope

Tested live on the audited conversation, signed in. A turn the scroll passes
before its image loads is still rebuilt from the stored record, with the
stored copy of the image: 9 of 180 in that run. The 50 MB cap on embedded
images is unchanged.
