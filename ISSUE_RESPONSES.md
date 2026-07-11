# Issue Responses for GitHub

## Issue #25: Markdown format export mismatch
```
✅ Fixed in v0.7.2!

Thank you for the exceptionally clear report — the before/after test case made this straightforward to verify.

All three symptoms are fixed in the shared engine and every generated exporter:
- Prompt whitespace: `white-space: pre-wrap` user messages keep their line breaks, blank lines, and indentation (detected via class, inline style, and computed style, then protected from Markdown cleanup).
- Backslashes: inline code and table cells are no longer backslash-escaped, so `\n` stays `\n`. Inline code with backticks now uses longer CommonMark delimiters instead of invalid escapes.
- Code block lines: extraction no longer trusts `innerText` on detached clones (it degrades to `textContent` there and drops line breaks that come from element/`<br>` boundaries in Firefox-based browsers like LibreWolf).

The exporter now reproduces your `patched.md` byte-for-byte from a fixture mirroring your conversation, and each symptom has a regression test. Also deferred `revokeObjectURL` so Firefox-family browsers can't abort the download.
```

## Issue #19: FR: Properly handle tables
```
✅ Fixed in v0.6.0!

Rendered HTML tables are now preserved across exporters:
- Markdown and Gemini Markdown convert tables into pipe-table syntax.
- HTML and PDF-ready exports keep structured `<table>` markup with basic styling.
- Complex spans are flattened into readable rows/cells rather than preserving advanced layout.

Thanks for the feature request!
```

## Issue #18: Mathjax support
```
✅ Fixed in v0.6.0!

MathJax/KaTeX output is now exported from the embedded TeX annotations instead of the visual fallback text:
- Inline math becomes `$...$`
- Display math becomes `$$...$$`
- Markdown cleanup no longer doubles LaTeX backslashes

Thanks for the clear repro and expected-output example!
```

## Issue #12: Improve the export file names
```
✅ Fixed in v0.5.0!

Exported files now use the conversation title in the filename:
- Before: `ChatGPT_Conversation_2025-09-09.md`
- After: `Payment calculation (2025-09-09).md`

All three exporters (markdown, PDF, HTML) have been updated with this improvement.

Thanks for the suggestion!
```

## Issue #6: Output contains duplicate chat turns
```
✅ Fixed in v0.5.0!

Added the `.group/conversation-turn` selector as suggested, plus enhanced duplicate detection:
- Better selector specificity to avoid nested elements
- Content hashing to identify true duplicates
- Improved message consolidation logic

The exporters should now correctly identify unique messages. Please test and let me know if you still see duplicates.

Thanks for reporting this!
```

## Issue #7: Script not working with Deep Research responses
```
⚠️ Partially addressed in v0.5.0

Improvements made:
- Better message detection selectors
- Enhanced content extraction logic
- Improved handling of complex DOM structures

The new selectors should capture Deep Research content better, but I'd appreciate if you could test with your specific Deep Research conversations and report back.

If issues persist, please share a snippet of the DOM structure from Deep Research responses so we can add specific handling.
```

## Issue #8: Export button is not visible
```
ℹ️ This appears to be a userscript-specific issue.

The console scripts work correctly. For userscripts, you'll need to update:
1. Change target element to `document.getElementById('sidebar')`
2. Use `prepend()` instead of `appendChild()`

The console exporters (which this repo maintains) are working properly. The userscript files appear to be maintained separately on GreasyFork.

As a workaround, you can use the console method directly - it's just as effective!
```

## Issue #13: Actual conversation URLs are not matched by the rules
```
ℹ️ This is a userscript configuration issue.

The userscript metadata needs updating to include:
- `https://chatgpt.com/c/*`
- `https://chatgpt.com/g/*`

The console scripts work on all ChatGPT URLs. The userscript files on GreasyFork would need to be updated with the new URL patterns.

For now, please use the console method which works on all ChatGPT conversation URLs.
```
