# Release v0.5.0 - Smart Export Edition

## 🎉 Major Improvements

### 📁 Smart File Naming (Fixes #12)
- Exported files now use the actual conversation title
- Format: `{ConversationTitle} (YYYY-MM-DD).{ext}`
- Example: `Payment calculation (2025-09-09).md`
- No more generic `ChatGPT_Conversation_` filenames!

### 📄 True PDF Support
- PDF exporter completely rewritten to work within CSP restrictions
- Creates beautifully formatted HTML optimized for PDF printing
- Professional styling with color-coded message boxes
- Clear instructions that won't appear in final PDF

### 🔍 Better Duplicate Detection (Fixes #6)
- Added `.group/conversation-turn` selector for accurate message detection
- Enhanced content hashing to prevent duplicates
- Improved message consolidation logic

### 🛡️ Security & Compatibility
- All exporters now work without external dependencies
- Fully compliant with ChatGPT's Content Security Policy
- No external script loading required

## 📦 What's Changed

### Modified Files
- `exporter-markdown.js` - Smart file naming, improved selectors
- `exporter-pdf.js` - Complete rewrite for CSP compliance
- `exporter-html.js` - New standalone HTML exporter
- `README.md` - Updated documentation

### New Files
- `CLAUDE.md` - Documentation for Claude Code instances
- `EXPORTER_GUIDE.md` - Comprehensive user guide
- `test-fixes.js` - Test suite for verification

## 🐛 Issues Addressed
- ✅ Fixed #12: Improve export file names
- ✅ Fixed #6: Output contains duplicate chat turns
- ⚠️ Partial #7: Better support for Deep Research responses
- ℹ️ Note: Issues #13 and #8 are userscript-specific

## 💻 How to Use

1. Open ChatGPT conversation
2. Open Console (F12)
3. Paste exporter code
4. File downloads with conversation title!

For PDF: Open the downloaded HTML and press Ctrl+P to save as PDF.

## 🙏 Thanks
Thanks to all issue reporters for helping improve this tool!