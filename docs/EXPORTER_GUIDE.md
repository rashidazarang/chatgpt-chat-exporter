# ChatGPT Chat Exporter - Format Guide

## Available Exporters

All shipped exporters are generated from the shared engine in `src/extraction-engine.js`. The console scripts remain self-contained and pasteable; the userscripts embed the same engine plus the native ChatGPT menu integration from `src/userscript-ui.js` at build time.

### 1. **exporter-markdown.js** - Markdown Export
- **Output:** `.md` files
- **Best for:** Text editors, GitHub, documentation
- **File naming:** `{ConversationTitle} (YYYY-MM-DD).md`
- **Features:**
  - Clean markdown formatting
  - Preserves code blocks with syntax highlighting
  - Converts rendered tables to Markdown tables
  - Exports MathJax/KaTeX equations as `$...$` and `$$...$$`
  - Embeds available raster images, with links or readable placeholders when bytes are unavailable
  - Lightweight text format
  - Easy to edit and share

### 2. **exporter-pdf.js** - PDF Export
- **Output:** HTML file optimized for PDF conversion
- **Best for:** Archiving, printing, sharing as professional documents
- **File naming:** `{ConversationTitle} (YYYY-MM-DD) - PrintToPDF.html`
- **Features:**
  - Works without external runtime libraries; site CSP still applies
  - Professional formatting with blue/gray message boxes
  - Preserves printable code blocks, tables, and equations
  - Keeps available raster images and readable file/artifact references
  - Automatic page break handling
  - Clear on-screen instructions (hidden in PDF)
  - One-click conversion to PDF via browser print

### 3. **exporter-html.js** - HTML Export
- **Output:** `.html` files
- **Best for:** Web viewing, custom styling, print-to-PDF
- **File naming:** `{ConversationTitle} (YYYY-MM-DD).html`
- **Features:**
  - Styled HTML with CSS
  - Keeps code blocks and tables as structured HTML
  - Keeps links, media placeholders, and file/artifact placeholders
  - Can be opened in any browser
  - Print to PDF using browser (Ctrl+P / Cmd+P)
  - Includes formatting and structure

## How to Use

1. **Open ChatGPT conversation** in your browser
2. **Open Developer Console** (F12 or right-click → Inspect → Console)
3. **Copy the entire contents** of your chosen exporter file
4. **Paste in console** and press Enter
5. **File will download automatically**

## Google Gemini

Use `gemini-exporter-markdown.js` from a conversation at `gemini.google.com/app`. The Gemini adapter looks for current `user-query`, `model-response`, `message-content`, and `code-block` structures before falling back to broader selectors.

## Quick Comparison

| Format | File Size | Editability | Formatting | Best Use Case |
|--------|-----------|-------------|------------|---------------|
| Markdown (.md) | Smallest | Easy | Basic | Documentation, GitHub |
| PDF (.pdf) | Medium | No | Professional | Archiving, Sharing |
| HTML (.html) | Small | Yes (with editor) | Rich | Web viewing, Custom styling |

## Notes

- **PDF Exporter:** Downloads an HTML file with clear instructions. Open it and press Ctrl+P to save as PDF
- **Userscripts:** Add Markdown and PDF actions beneath Share in conversation menus and replace the header Share dialog with Copy link, Markdown, and PDF actions
- **HTML Exporter:** Basic HTML for web viewing. Can also be printed to PDF but without special formatting
- **File Names:** All exporters now use the conversation title for better organization
- **Math:** Markdown exports use common MathJax delimiters so compatible viewers can render equations
- **Compatibility:** synthetic regression tests cover ChatGPT and Gemini shapes. Current live browser validation is tracked in [RELEASE_AUDIT.md](RELEASE_AUDIT.md); historical live observations are not a current compatibility guarantee.
- **Development:** Run `npm run build` after editing `src/extraction-engine.js`; `npm test` verifies generated scripts are up to date and runs jsdom fixture coverage.

## Troubleshooting

### PDF not working?
- The PDF exporter creates an HTML file optimized for printing
- Open the downloaded HTML file in your browser
- Press Ctrl+P (Cmd+P on Mac) and choose "Save as PDF"

### No messages found?
- Make sure you're on a ChatGPT conversation page
- Try refreshing the page and running the script again
- Check console for error messages

### Duplicate messages?
- Duplicate copies of one message on the page collapse by identity: ChatGPT's message id, its numbered turn, or its position in the conversation
- Repeated identical turns — two "OK" replies, say — are separate messages and are kept

## Bookmarklets and large conversations

Copy the text of a [bookmarklet file](https://github.com/rashidazarang/chatgpt-chat-exporter/tree/master/public/bookmarklets) into a new bookmark's URL, or open `public/bookmarklets/index.html` from a downloaded repository and drag a format link to the bookmarks bar. The entire program is embedded, with no remote code loader; replace the bookmark to upgrade. Each one is over 100,000 characters: Chromium-based browsers store that, while Firefox rejects bookmark URLs longer than 65,536 characters — use the userscript or console there.

For ChatGPT Markdown, `conversationFetchTimeout` defaults to 60000 ms and `conversationMaxDuration` to 120000 ms. Optional enrichment uses a separate 5000 ms request timeout and 15000 ms budget. Existing explicit `metadataFetchTimeout` / `metadataMaxDuration` overrides still apply to the primary read unless the new conversation options are set. A supplied `metadataDeadline` remains an outer bound. HTML/PDF remain DOM-first: after scrolling, they read the stored conversation with the same primary budget, check the capture against it, and render any turn the sweep missed from it — including after the sweep ran out of `maxDuration`. Temporary chats have no stored copy, so there the page is the only source.

Completed Deep Research reports can be recovered from app metadata and task streams. An unavailable report makes the export incomplete and leaves a visible warning in the saved file. Recovered HTML/PDF text is escaped; it preserves content and sources, not the original iframe’s rendered layout.

Downloaded images get time in proportion to their number: 15 seconds plus 3 per image, up to 3 minutes, with 15 seconds per download. Set `attachmentMaxDuration` / `attachmentFetchTimeout` to change that; an explicit `metadataMaxDuration` / `metadataFetchTimeout` also bounds it. Generated images and code-execution charts are read from the stored conversation in Markdown exports, and from the page in HTML/PDF.

Embedded DOM images and downloaded attachments share `maxTotalEmbeddedImageBytes` (default 50 MiB) and `maxEmbeddedImageBytes` (default 20 MiB). `maxCanvasPixels` defaults to 16,777,216 and is checked before canvas allocation or serialization. Set a byte budget to zero to disable embedding; remote URLs or readable placeholders remain. These limits do not rewrite data URLs already contained in the provider’s native Markdown text.
