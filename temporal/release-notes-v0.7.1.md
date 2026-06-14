# Release Notes - v0.7.1

## Summary

v0.7.1 hardens exported Markdown, HTML, and PDF-ready output against two privacy and correctness issues found in a security review.

## Highlights

- Exported files no longer include the exact ChatGPT or Gemini conversation URL by default.
- The shared engine still supports URL metadata through the explicit `includeSourceUrl: true` option.
- Markdown code blocks now choose a fence longer than any backtick run inside the exported code.
- Markdown code block info strings are sanitized before serialization.
- Markdown cleanup now preserves fenced blocks with dynamic fence lengths.
- Generated console scripts and userscripts have been rebuilt from the shared engine.

## Validation

- `npm run build`
- `npm test`
