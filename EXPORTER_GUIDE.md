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
  - Adds readable placeholders for images, charts, media, files, and artifacts
  - Lightweight text format
  - Easy to edit and share

### 2. **exporter-pdf.js** - PDF Export
- **Output:** HTML file optimized for PDF conversion
- **Best for:** Archiving, printing, sharing as professional documents
- **File naming:** `{ConversationTitle} (YYYY-MM-DD) - PrintToPDF.html`
- **Features:**
  - Works without external libraries (bypasses CSP restrictions)
  - Professional formatting with blue/gray message boxes
  - Preserves printable code blocks, tables, and equations
  - Keeps media and file/artifact cards as readable placeholders
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
- **Compatibility:** v0.7.0 is based on a local live Chrome/Crawlio audit of current ChatGPT and Gemini rendering. Raw authenticated captures are not included in the repository.
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
- The exporters now include better duplicate detection
- Uses content hashing to identify and skip duplicates
