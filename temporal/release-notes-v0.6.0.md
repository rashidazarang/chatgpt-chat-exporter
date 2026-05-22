# ChatGPT Chat Exporter v0.6.0 Release Notes

## Stabilization Release

v0.6.0 updates the browser exporters for current ChatGPT and Gemini conversation UIs.

## Fixes

- Preserves modern ChatGPT CodeMirror code blocks, including language labels and line breaks.
- Exports KaTeX/MathJax annotations as `$...$` and `$$...$$` instead of duplicated visual text.
- Converts rendered tables into Markdown tables and keeps table markup in HTML/PDF-ready exports.
- Keeps PDF/HTML code blocks as real structured markup instead of escaped literal strings.
- Refreshes Gemini message selectors and rich-content extraction for code, links, tables, and media placeholders.

## Quality

- Adds a `node --test` fixture suite using `jsdom`.
- Covers ChatGPT CodeMirror, math, table, link, media, HTML, PDF-ready HTML, and Gemini Markdown exports.
