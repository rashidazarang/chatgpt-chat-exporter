# ChatGPT Chat Exporter

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://github.com/rashidazarang/chatgpt-chat-exporter/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![CI](https://github.com/rashidazarang/chatgpt-chat-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/rashidazarang/chatgpt-chat-exporter/actions/workflows/ci.yml)

Export your **ChatGPT** and **Google Gemini** conversations as clean, readable **Markdown**, **HTML**, or **print-ready PDF** files — with faithful sender labels, code blocks, tables, math, and formatting.

No install, no server, no account: everything runs locally in your browser.

![ChatGPT Chat Exporter in action](demo/demo.gif)

---

## ✅ Features

- 📝 Captures **all messages** with proper sender attribution
- 📜 **Long conversations export fully**: the exporter auto-scrolls through virtualized (lazy-loaded) conversations so messages ChatGPT removed from the page are still captured
- 🔗 **Web-search references included**: citation sources in a response are appended as a numbered **References** list, matching ChatGPT's own copy output
- 🔤 **Faithful text**: prompt line breaks, indentation, and backslashes are preserved exactly as written — no re-flowed whitespace, no doubled `\` escapes
- 🔧 Preserves **code blocks** (including CodeMirror), tables, MathJax/KaTeX equations, lists, links, media placeholders, and file/artifact cards
- 📄 Exports to **Markdown**, **HTML**, or **printable PDF**
- 🆕 **Google Gemini** conversation export support
- 🔒 **Private by default**: exports show the provider label without embedding your exact conversation URL
- 🧩 Integrates with ChatGPT's native conversation and Share menus — and falls back to a floating **Export** button when your account has no Share control (e.g. enterprise policies)
- 🚀 Works directly from the browser console — or install as a userscript
- 🛡️ One shared, tested extraction engine powers every exporter, with multiple selector fallbacks to survive UI changes

---

## 📦 How to Use

### Method 1: Install as Userscript (Recommended)

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox)
   - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (Firefox)

2. Install either userscript. Both installers expose Markdown and PDF export actions, so existing installations keep working without needing both scripts:

   **From GreasyFork (Recommended):**
   - [Markdown Exporter](https://greasyfork.org/en/scripts/530789-chatgpt-chat-exporter-markdown)
   - [PDF Exporter](https://greasyfork.org/en/scripts/530790-chatgpt-chat-exporter-pdf)

   **Directly from GitHub:**
   - [Markdown Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/chatgpt-markdown-exporter.user.js)
   - [PDF Exporter](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/chatgpt-pdf-exporter.user.js)

3. Open a ChatGPT conversation, then either:
   - Open the conversation's **•••** menu and choose **Export to Markdown** or **Export to PDF**.
   - Click the header **Share** button and choose **Share…**, **Copy link**, **Export to Markdown**, or **Export to PDF**.
   - If your account has no Share control at all (sharing disabled by an enterprise policy, for example), a floating **Export** button appears in the bottom-right corner with the same options.

### Method 2: Browser Console

1. Open a conversation in ChatGPT
2. Open DevTools → Console (`F12` or `Cmd+Option+J`)
3. Paste the contents of the exporter you want and press Enter:
   - **Markdown (.md):** [exporter-markdown.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-markdown.js)
   - **HTML (.html):** [exporter-html.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-html.js)
   - **PDF (print-ready HTML):** [exporter-pdf.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/exporter-pdf.js)
4. The file downloads automatically, named after your conversation title

### Google Gemini

1. Open your conversation at [gemini.google.com](https://gemini.google.com)
2. Open DevTools → Console (`F12`)
3. Paste the contents of [gemini-exporter-markdown.js](https://github.com/rashidazarang/chatgpt-chat-exporter/raw/master/gemini-exporter-markdown.js) and press Enter

---

## 🖼️ Demo

| Markdown Output | PDF View |
|-----------------|----------|
| ![](demo/preview-md.png) | ![](demo/preview-pdf.png) |

---

## 🔧 What's New in v0.8.2

**Fixes found by testing against a live ChatGPT conversation** — each one ships with a regression test that fails on v0.8.1:

- 🔢 **Long exports were out of order** (critical): the auto-scroll sweep appended messages as it captured them, so a 12-turn conversation exported from the bottom came out as turns `1, 2, 8, 9, 10, 11, 12, 3, 4, 5, 6, 7` — ChatGPT hadn't unmounted the bottom turns yet when the sweep jumped to the top. Messages now carry their offset in the conversation and are sorted into reading order.
- ✂️ **Sweeps could stop after the first screenful**: a virtualizer swapping turns for placeholders can drag `scrollTop` backwards, which the old loop read as "reached the bottom" and exported a fragment. Progress is now judged by messages captured and by actually reaching the end.
- 🧩 **Export entries never appeared in the ••• menu on desktop**: ChatGPT hides that menu's Share row (`sm:hidden`) when the header Share button is present, and the entries were cloned from it. They now clone a row that actually renders.
- 🔗 **"Share prompt" on a message stays native**: per-message share buttons were being intercepted by the export menu.
- 📋 **Sidebar conversation menus are left alone** — they belong to other chats, but an export always reads the open one.

<details>
<summary>📝 Previous updates</summary>

### v0.8.1

**The Export UI No Longer Depends on ChatGPT's Share Button** ([#31](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/31), thanks [@n8henrie](https://github.com/n8henrie)):

- 🎯 **Floating Export button is back — as a fallback**: v0.8.0 moved exports into ChatGPT's native menus, which left accounts with sharing disabled (enterprise policies) with no export control at all. A floating **Export** button now appears whenever no Share control exists on the page, and steps aside automatically when one does.
- 🧯 **Console escape hatch**: the userscript exposes `ChatExporter.markdown()`, `ChatExporter.pdf()`, and `ChatExporter.showLauncher()` so an export is always reachable, whatever ChatGPT's UI does next.
- 🛡️ **Strict-CSP safe**: the UI builds its icons and menu items through DOM APIs instead of `innerHTML`, so pages that enforce Trusted Types can't block it. No shipped code touches an HTML injection sink — covered by a regression test.
- 🌍 **Localized menus labelled correctly**: export entries cloned into a non-English **•••** menu now get their own label instead of repeating ChatGPT's.
- 🧹 Cloned menu entries no longer carry ChatGPT's own `data-testid`s, so its internal queries never pick up our copies.

### v0.8.0

**Full Captures for Long Conversations** ([#28](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/28), [#29](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/29)):

- 📜 **Lazy-loading handled**: ChatGPT virtualizes long conversations — messages scrolled out of view are removed from the DOM, so a single DOM pass could only ever export a fragment. The engine now auto-scrolls the conversation container from top to bottom, serializing each message while it exists, then restores your scroll position. Manual pre-scrolling is no longer needed (and never worked, since the DOM forgets what you scrolled past).
- 🔗 **References exported** ([#27](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/27)): web-search citations in a response (recognized by their `utm_source=chatgpt.com` links or citation containers) are appended to that message as a numbered **References** list in Markdown, HTML, and PDF exports.
- 🧩 **Native menu polish**: the header Share menu now includes a **Share…** item that opens ChatGPT's real share dialog, and share controls are recognized by `data-testid` so the integration works on non-English ChatGPT locales.

### v0.7.2

**Markdown Fidelity Fixes** (thanks [@kbelleau23-byte](https://github.com/kbelleau23-byte) for the detailed report and test case in [#25](https://github.com/rashidazarang/chatgpt-chat-exporter/issues/25)):

- 🔤 **Prompt whitespace preserved**: user messages rendered with `white-space: pre-wrap` keep their line breaks, blank lines, and indentation instead of being collapsed onto one line
- ➖ **No more doubled backslashes**: inline code and table cells keep `\n`, `C:\path`, and other backslash sequences verbatim (backslash escapes are never processed inside code spans, so escaping them only corrupted the output)
- 🧵 **Code block line breaks**: code lines separated by element boundaries or `<br>` tags no longer run together (`Line 1Line 2…`) — extraction no longer trusts `innerText` on detached nodes
- 💠 **Correct backtick handling**: inline code containing backticks now uses longer CommonMark delimiters (`` ``a`b`` ``) instead of invalid `\`` escapes
- 📚 **Nested lists indent properly** and ordered-list continuation lines align with their markers
- 🔣 **Entity-safe text**: conversations that literally discuss `&amp;`-style HTML entities are no longer silently un-escaped
- 🛡️ **Hardening**: randomized internal placeholders (no marker collisions/injection), URL escaping for spaces and parentheses in links, safer filenames, and delayed `revokeObjectURL` so downloads can't be aborted in Firefox-based browsers

### v0.7.1

**Security and Privacy Fixes:**
- 🔒 **Private Source Metadata by Default**: Markdown, HTML, and PDF-ready exports now show the provider label without embedding the exact conversation URL unless `includeSourceUrl: true` is explicitly used.
- 🧱 **Safe Markdown Code Fences**: Code blocks now choose a fence longer than any backtick run in the exported code, preventing premature fence closure when conversations contain triple backticks.
- 🧪 **Regression Coverage**: Tests cover source URL omission, explicit source URL opt-in, and Markdown fence-injection cases across generated exporters.

### v0.7.0

**Live Compatibility Rewrite:**
- 🧭 **Shared Extraction Engine**: ChatGPT console scripts, Gemini console script, and userscripts now embed one canonical extraction engine generated from `src/extraction-engine.js`
- 🧱 **Provider Adapters**: ChatGPT uses `data-message-author-role` first; Gemini uses current `user-query` / `model-response` custom elements first
- 🧩 **Modern Rich Content**: Handles CodeMirror, custom `code-block`, tables, links/citations, MathJax/KaTeX/TeX annotations, media placeholders, and basic file/artifact cards
- 🧪 **Expanded Synthetic Fixtures**: Tests cover live-observed ChatGPT and Gemini DOM shapes without including private authenticated captures

### v0.6.0

- 🧱 **Modern ChatGPT Code Blocks**: Supports CodeMirror-based code blocks used by current `chatgpt.com`
- ∑ **MathJax/KaTeX Support**: Exports equations as inline `$...$` or block `$$...$$` Markdown
- 📊 **Table Export**: Converts rendered tables into Markdown tables and keeps tables in HTML/PDF exports
- ✨ **Gemini Refresh**: Updated Gemini selectors and rich-content handling

### v0.5.0

- 🎯 **Smart File Naming**: Exported files use conversation titles instead of generic names
- 📄 **True PDF Support**: PDF exporter creates print-optimized HTML that converts perfectly to PDF
- 🔍 **Better Message Detection**: Improved selectors to prevent duplicate messages
- 🛡️ **CSP Compliant**: All exporters work within ChatGPT's security restrictions

### v0.4.0

- 🆕 **Google Gemini Support**: Full conversation export for Gemini
- 🔧 **Unified Codebase**: Shared logic and improvements across platforms

</details>

---

## 🏗️ How It Works

All exporters are generated from a single, tested engine:

```
src/extraction-engine.js     ← canonical source (edit this)
src/userscript-ui.js         ← native ChatGPT menu integration
scripts/build-exporters.js   ← generates the files below
├── exporter-markdown.js         ChatGPT → Markdown (console)
├── exporter-html.js             ChatGPT → HTML (console)
├── exporter-pdf.js              ChatGPT → print-ready HTML (console)
├── gemini-exporter-markdown.js  Gemini → Markdown (console)
├── chatgpt-markdown-exporter.user.js   userscript + native export menus
└── chatgpt-pdf-exporter.user.js        userscript + native export menus
```

The engine finds messages through a cascade of selector strategies (data attributes → ARIA → semantic HTML → content heuristics), so it keeps working across ChatGPT and Gemini UI revisions. Rich content — code, tables, math, links, media — is converted through a processing pipeline that protects verbatim regions (code, pre-wrap prompts) from whitespace cleanup.

## 🧑‍💻 Development

```bash
npm install     # dev dependency: jsdom (tests only)
npm run build   # regenerate all exporters from src/extraction-engine.js
npm test        # verify generated files are current + run the jsdom test suite
```

Never edit the generated exporter files directly — change `src/extraction-engine.js`, `src/userscript-ui.js`, or the build script and run `npm run build`.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [EXPORTER_GUIDE.md](EXPORTER_GUIDE.md) for details.

## 🔐 Privacy & Security

- Everything runs **locally in your browser**; no data leaves your machine
- Exports **omit your exact conversation URL** by default (the engine supports `includeSourceUrl: true` for explicit opt-in)
- HTML/PDF output escapes all conversation content; unsafe link schemes (`javascript:`, `data:`) are never exported as links

## ❓ Troubleshooting

- **"No messages found"** — the site's DOM may have changed. Update to the latest exporter version; if it persists, [open an issue](https://github.com/rashidazarang/chatgpt-chat-exporter/issues) with your browser and a description of the page.
- **Long conversation exports only a fragment, or turns come out in the wrong order** — update to v0.8.2+. v0.8.0 added the auto-scroll sweep for lazily-loaded conversations; v0.8.2 fixed sweeps that ended early and exports that were ordered by capture rather than by conversation. Leave the tab in the foreground while the sweep runs; the export downloads when it finishes.
- **Export actions don't appear** — confirm the userscript is enabled for `chatgpt.com`, reload the page, and open a conversation's **•••** or header **Share** menu. On accounts with no Share control (v0.8.1+), look for the floating **Export** button in the bottom-right corner instead; you can also force it on from the console with `ChatExporter.showLauncher()`, or export directly with `ChatExporter.markdown()` / `ChatExporter.pdf()`.
- **Downloads blocked in the console** — some browsers require you to allow downloads/popups triggered from DevTools; the userscript method avoids this.

---

## 🚀 Version History

- **v0.8.2** (Current) - Conversation order preserved in long exports, sweeps no longer stop early, ••• menu entries visible on desktop, per-message "Share prompt" left native
- **v0.8.1** - Floating **Export** fallback for accounts with no Share control, console API, and Trusted-Types-safe UI (#31)
- **v0.8.0** - Full export of virtualized long conversations via auto-scroll (#28, #29), References list for web-search citations (#27), native menu export integration with locale-safe share detection (#26)
- **v0.7.2** - Markdown fidelity: preserved prompt whitespace, no doubled backslashes, correct code-span/list/entity handling (#25)
- **v0.7.1** - Source URL privacy by default and safe Markdown code fences
- **v0.7.0** - Shared extraction engine, live compatibility audit, current ChatGPT/Gemini provider adapters
- **v0.6.0** - Modern ChatGPT code blocks, MathJax/KaTeX, tables, Gemini refresh
- **v0.5.0** - Smart file naming, true PDF support, improved duplicate detection
- **v0.4.0** - Added Google Gemini support, multi-platform architecture
- **v0.3.0** - Major ChatGPT stability fixes, modern selectors, duplicate prevention
- **v0.2.0** (Archived) - Original ChatGPT working version

---

## 📜 License

[MIT](LICENSE)
