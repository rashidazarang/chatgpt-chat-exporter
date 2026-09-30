# v1.2.4 — readable Markdown and downloadable images

Markdown conversations with available image bytes now download as a ZIP containing the `.md` document and an `images/` folder. The document references local image files instead of embedding long base64 strings. Repeated images share one file. Extract the ZIP and keep the folder beside the document to view, open or copy the images.

Text-only conversations still download as a single `.md` file. HTML and PDF-ready exports keep embedded images. Remote image links and readable placeholders remain when bytes are unavailable; existing image acquisition limits still apply.

## Implementation

- The shared extraction engine prepares the bundle for every Markdown entry point: both ChatGPT userscripts, ChatGPT/Gemini console exporters, and bookmarklets.
- Raster bytes are preserved exactly. ZIPs are created locally with UTF-8 filenames, stored entries and CRC32 checksums, without runtime dependencies or a server.
- Image destinations are scanned linearly. Fenced and inline code, escaped image syntax and raw HTML reasoning recaps remain verbatim.
- Set `bundleImages: false` on the engine export API to retain inline data URLs. `download: false` returns the prepared Markdown and `files` entries without downloading. Low-level serializers remain text serializers.
- The version is bumped in the engine, package, lockfile and generated userscript headers so installations can update.

## Validation

- Unit and browser regressions verify real ZIP downloads, archive structure and CRCs, Unicode names, exact image bytes, repeated-image reuse, text-only fallback, code preservation, malformed labels, and all generated distributions.
- The supplied 66 MiB export was converted locally into 326 KiB of Markdown with 60 image references and 53 unique raster files. Every image matched the original bytes; reversing the local image links reproduced the original document exactly. The private export is not part of the repository or release.
- Synthetic Chromium, Firefox and WebKit checks exercise downloads from all shipped entry points. These checks do not certify a userscript manager's update UI or a new signed-in provider session.
