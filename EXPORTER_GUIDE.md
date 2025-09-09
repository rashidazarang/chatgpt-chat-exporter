# ChatGPT Chat Exporter - Format Guide

## Available Exporters

### 1. **exporter-markdown.js** - Markdown Export
- **Output:** `.md` files
- **Best for:** Text editors, GitHub, documentation
- **File naming:** `{ConversationTitle} (YYYY-MM-DD).md`
- **Features:**
  - Clean markdown formatting
  - Preserves code blocks with syntax highlighting
  - Lightweight text format
  - Easy to edit and share

### 2. **exporter-pdf.js** - PDF Export
- **Output:** HTML file optimized for PDF conversion
- **Best for:** Archiving, printing, sharing as professional documents
- **File naming:** `{ConversationTitle} (YYYY-MM-DD) - PrintToPDF.html`
- **Features:**
  - Works without external libraries (bypasses CSP restrictions)
  - Professional formatting with blue/gray message boxes
  - Automatic page break handling
  - Clear on-screen instructions (hidden in PDF)
  - One-click conversion to PDF via browser print

### 3. **exporter-html.js** - HTML Export
- **Output:** `.html` files
- **Best for:** Web viewing, custom styling, print-to-PDF
- **File naming:** `{ConversationTitle} (YYYY-MM-DD).html`
- **Features:**
  - Styled HTML with CSS
  - Can be opened in any browser
  - Print to PDF using browser (Ctrl+P / Cmd+P)
  - Includes formatting and structure

## How to Use

1. **Open ChatGPT conversation** in your browser
2. **Open Developer Console** (F12 or right-click → Inspect → Console)
3. **Copy the entire contents** of your chosen exporter file
4. **Paste in console** and press Enter
5. **File will download automatically**

## Quick Comparison

| Format | File Size | Editability | Formatting | Best Use Case |
|--------|-----------|-------------|------------|---------------|
| Markdown (.md) | Smallest | Easy | Basic | Documentation, GitHub |
| PDF (.pdf) | Medium | No | Professional | Archiving, Sharing |
| HTML (.html) | Small | Yes (with editor) | Rich | Web viewing, Custom styling |

## Notes

- **PDF Exporter:** Downloads an HTML file with clear instructions. Open it and press Ctrl+P to save as PDF
- **HTML Exporter:** Basic HTML for web viewing. Can also be printed to PDF but without special formatting
- **File Names:** All exporters now use the conversation title for better organization

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