# ChatGPT Chat Exporter 
Version v0.4.0

Export your full **ChatGPT** and **Google Gemini** conversations as clean, readable **Markdown** or **PDF** files — including all messages, sender labels, and code blocks.

> **🎯 Major Update:** Added **Google Gemini** support! Now exports conversations from both ChatGPT and Gemini with the same high-quality accuracy and duplicate prevention.

![ChatGPT Chat Exporter in action](demo/demo.gif)

---

## ✅ Features

- 🆕 **NEW:** **Google Gemini** conversation export support
- 📝 Captures **all messages** with proper sender attribution
- 🔧 Preserves **code blocks**, formatting, and structure
- 📄 Supports export as **Markdown** or **Printable PDF**
- 🚀 Works directly from browser — no install required
- 🛡️ Future-proof against interface changes
  
---

## 📦 How to Use

### ChatGPT Conversations

#### Method 1: Console Method
1. Open a conversation in ChatGPT
2. Open DevTools → Console
3. **For Markdown:** Paste contents of **[exporter-markdown.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-markdown.js)** 
4. **For PDF:** Paste contents of **[exporter-pdf.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-pdf.js)**
5. Hit Enter — file will download

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

## 🔧 What's New in v0.4.0

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

- **v0.4.0** (Current) - Added Google Gemini support, multi-platform architecture
- **v0.3.0** - Major ChatGPT stability fixes, modern selectors, duplicate prevention
- **v0.2.0** (Archived) - Original ChatGPT working version  
- **v1.1.0** (UserScript) - Latest stable userscript releases

---

## 📜 License

[MIT](LICENSE)
