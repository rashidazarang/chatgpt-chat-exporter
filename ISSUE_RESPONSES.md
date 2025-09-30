# Issue Responses for GitHub

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