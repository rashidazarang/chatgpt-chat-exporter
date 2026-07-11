# Release Notes - v0.7.2

## Summary

v0.7.2 fixes the Markdown fidelity problems reported in issue #25 — collapsed prompt whitespace and doubled backslashes — and hardens the shared extraction engine based on a full code audit.

## Fixes (issue #25)

- User messages rendered with `white-space: pre-wrap` keep their line breaks, blank lines, and indentation. Pre-wrap regions are detected by class, inline style, and computed style on the live tree, then protected from Markdown whitespace cleanup with collision-proof placeholders.
- Inline code spans no longer double backslashes (`\n` stayed `\n`, not `\\n`). Backslash escapes are never processed inside code spans, so escaping them only corrupted the output.
- Inline code containing backticks now uses longer CommonMark delimiters with space padding instead of invalid `\`` escapes.
- Table cells no longer double backslashes; only the structural `|` is escaped.
- Code blocks whose lines are separated by element boundaries or `<br>` tags no longer run together. `getCodeText` no longer trusts `innerText`, which degrades to `textContent` on the detached clones the serializer works with.

## Audit hardening

- Markdown cleanup no longer strips leading indentation, restoring nested list structure; ordered-list continuation lines align with their marker width.
- Markdown cleanup no longer un-escapes `&amp;` / `&lt;` / `&gt;`, which corrupted conversations that literally discussed HTML entities.
- Internal block placeholders now carry a random per-run token, so conversation text can neither collide with nor inject through them.
- Markdown link URLs additionally escape spaces and parentheses.
- Display math (`$$...$$`) text nodes pass through serialization without whitespace collapsing.
- Exported filenames strip control characters and trailing dots/spaces.
- `revokeObjectURL` is deferred so Firefox-based browsers (the environment in issue #25) cannot abort the download.
- Userscript `@version` headers are generated from `package.json` instead of a hardcoded string.
- Added GitHub Actions CI running the build check and test suite on Node 20 and 22.
- package.json metadata corrected (name, description, MIT license, author, `main` pointing at the engine source).

## Validation

- `npm run build`
- `npm test` (11 tests, including new regressions for every issue #25 symptom)
- Byte-for-byte reproduction of the expected output attached to issue #25 from a fixture mirroring the reported conversation.
