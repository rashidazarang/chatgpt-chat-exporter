# ChatGPT Chat Exporter v0.3.0

Export your full ChatGPT conversations as clean, readable **Markdown** or **PDF** files — including all messages, sender labels, and code blocks.

> **🎯 Major Update v0.3.0:** Fixed critical export issues including massive duplicates, broken sender detection, and missing messages. Now delivers 90%+ export accuracy with modern selector support.

![ChatGPT Chat Exporter in action](demo/demo.gif)

---

## ✅ Features

- ✅ **Fixed:** Eliminates massive message duplicates (4x+ repetition)
- ✅ **Fixed:** Accurate sender detection and message counting
- ✅ **New:** Extracts actual conversation titles (not just generic names)
- ✅ **Enhanced:** Modern selector cascade for future ChatGPT updates
- ✅ **Reliable:** Intelligent duplicate prevention and content validation
- 📝 Captures **all messages** with proper sender attribution
- 🔧 Preserves **code blocks**, formatting, and structure
- 📄 Supports export as **Markdown** or **Printable PDF**
- 🚀 Works directly from browser — no install required
- 🛡️ Future-proof against ChatGPT interface changes

---

## 📦 How to Use

### Method 1: Console Method

If you prefer the manual method:

#### Export as Markdown
1. Open a conversation in ChatGPT
2. Open DevTools → Console
3. Paste contents of **[ChatGPT Markdown Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-markdown.js)** 
4. Hit Enter — `.md` file will download

#### Export as PDF
1. Same as above — paste **[ChatGPT PDF Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-pdf.js)**
2. A printable tab opens with full conversation
3. Click **Save as PDF**

---

### Method 2: Install as Userscript (Recommended)

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

---

## 🖼️ Demo

| Markdown Output | PDF View |
|-----------------|----------|
| ![](demo/preview-md.png) | ![](demo/preview-pdf.png) |

---

## 🔧 What's Fixed in v0.3.0

**Before v0.3.0:**
- ❌ Massive duplicates (5 messages → 20+ exports)
- ❌ Missing user messages 
- ❌ Broken sender detection (consecutive ChatGPT responses)
- ❌ Generic "Conversation with ChatGPT" titles

**After v0.3.0:**
- ✅ Clean exports (8 messages → 9 exports, 95% accuracy)
- ✅ Proper conversation titles extracted from page
- ✅ Robust multi-method sender identification
- ✅ Modern data attributes + legacy fallbacks
- ✅ Console logging for transparency

---

## 🚀 Version History

- **v0.3.0** (Current) - Major stability fixes, modern selectors, duplicate prevention
- **v0.2.0** (Archived) - Original working version  
- **v1.1.0** (UserScript) - Latest stable userscript releases

---

## 📜 License

[MIT](LICENSE)
