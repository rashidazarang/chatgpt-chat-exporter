# ChatGPT Chat Exporter 
*Version: v0.7.0*

Export your full **ChatGPT** conversations as clean, readable **Markdown** or **PDF** files — including all messages, sender labels, and code blocks.

> **Compatibility Update:** v0.7.0 rewrites extraction around a shared engine informed by a live Chrome/Crawlio audit of current ChatGPT and Gemini rendering. No private live captures are included in this repository.

![ChatGPT Chat Exporter in action](demo/demo.gif)

---

## ✅ Features

- 🆕 **Google Gemini** conversation export support
- 📝 Captures **all messages** with proper sender attribution
- 🔧 Preserves **CodeMirror/code blocks**, tables, MathJax/KaTeX equations, formatting, lists, links, media placeholders, and basic file/artifact cards
- 📄 Supports export as **Markdown** or **Printable PDF**
- 🚀 Works directly from browser — no install required
- 🛡️ Shared provider adapters reduce drift between console exporters and userscripts
  
---

## 📦 How to Use

### ChatGPT Conversations

#### Method 1: Console Method
1. Open a conversation in ChatGPT
2. Open DevTools → Console (F12)
3. Choose your export format:
   - **Markdown (.md):** Paste contents of **[exporter-markdown.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-markdown.js)**
   - **PDF (via HTML):** Paste contents of **[exporter-pdf.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-pdf.js)**
   - **HTML (.html):** Paste contents of **[exporter-html.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-html.js)**
4. Hit Enter — file will download with conversation title in filename

---

#### Method 2: Install as Userscript (Recommended)

This is the safest and most convenient method:

1. Install a userscript manager extension in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, etc.)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox)
   - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (Firefox)
  

2. Click one of these links to install the userscript:

      **Directly from GitHub:**
   - [Install Markdown Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/chatgpt-markdown-exporter.user.js)
   - [Install PDF Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/chatgpt-pdf-exporter.user.js)
     
   **From GreasyFork (Recommended):**
   - [Install Markdown Exporter from GreasyFork](https://greasyfork.org/en/scripts/530789-chatgpt-chat-exporter-markdown)
   - [Install PDF Exporter from GreasyFork](https://greasyfork.org/en/scripts/530790-chatgpt-chat-exporter-pdf)
   

3. Open ChatGPT and click the "Export as Markdown" or "Export as PDF" button that appears in the sidebar.

### Google Gemini Conversations

#### Console Method
1. Open your conversation at [gemini.google.com](https://gemini.google.com)
2. Open DevTools → Console (F12)
3. Paste contents of **[gemini-exporter-markdown.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/gemini-exporter-markdown.js)**
4. Hit Enter — `.md` file downloads automatically

---

## 🖼️ Demo

| Markdown Output | PDF View |
|-----------------|----------|
| ![](demo/preview-md.png) | ![](demo/preview-pdf.png) |

---

## 🔧 What's New in v0.7.0

**Live Compatibility Rewrite:**
- 🧭 **Shared Extraction Engine**: ChatGPT console scripts, Gemini console script, and userscripts now embed one canonical extraction engine generated from `src/extraction-engine.js`
- 🧱 **Provider Adapters**: ChatGPT uses `data-message-author-role` first; Gemini uses current `user-query` / `model-response` custom elements first
- 🧩 **Modern Rich Content**: Handles CodeMirror, custom `code-block`, tables, links/citations, MathJax/KaTeX/TeX annotations, media placeholders, and basic file/artifact cards
- 🧪 **Expanded Synthetic Fixtures**: Tests cover live-observed ChatGPT and Gemini DOM shapes without including private authenticated captures
- 🔒 **Private Audit Boundary**: v0.7.0 is based on a local live Chrome/Crawlio compatibility audit; raw captures remain private and untracked

## 📝 Previous Updates (v0.6.0)

**Stability Improvements:**
- 🧱 **Modern ChatGPT Code Blocks**: Supports CodeMirror-based code blocks used by current `chatgpt.com`
- ∑ **MathJax/KaTeX Support**: Exports equations as inline `$...$` or block `$$...$$` Markdown
- 📊 **Table Export**: Converts rendered tables into Markdown tables and keeps tables in HTML/PDF exports
- ✨ **Gemini Refresh**: Updated Gemini selectors and rich-content handling for code, tables, links, and media
- 🧪 **Fixture Tests**: Added `npm test` coverage for ChatGPT and Gemini export regressions

## 📝 Previous Updates (v0.5.0)

**Major Improvements:**
- 🎯 **Smart File Naming**: Exported files now use conversation titles instead of generic names
- 📄 **True PDF Support**: PDF exporter creates print-optimized HTML that converts perfectly to PDF
- 🔍 **Better Message Detection**: Improved selectors to prevent duplicate messages
- 🛡️ **CSP Compliant**: All exporters work within ChatGPT's security restrictions

## 📝 Previous Updates (v0.4.0)

**New Features:**
- 🆕 **Google Gemini Support**: Full conversation export for Gemini
- 🔧 **Unified Codebase**: Shared logic and improvements across platforms

**Enhanced Features (Both Platforms):**
- ✅ Modern selector cascade with platform-specific optimizations
- ✅ Platform-specific sender detection and content processing
- ✅ Intelligent duplicate prevention across both platforms
- ✅ Conversation title extraction for better file naming
- ✅ Console logging for transparency and debugging

---

## 🚀 Version History

- **v0.7.0** (Current) - Shared extraction engine, live Chrome/Crawlio compatibility audit, current ChatGPT/Gemini provider adapters
- **v0.6.0** - Modern ChatGPT code blocks, MathJax/KaTeX, tables, Gemini refresh
- **v0.5.0** - Smart file naming, true PDF support, improved duplicate detection
- **v0.4.0** - Added Google Gemini support, multi-platform architecture
- **v0.3.0** - Major ChatGPT stability fixes, modern selectors, duplicate prevention
- **v0.2.0** (Archived) - Original ChatGPT working version

---

## 📜 License

[MIT](LICENSE)
