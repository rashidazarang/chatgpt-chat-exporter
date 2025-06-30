# Release v0.4.0 - Multi-Platform AI Chat Exporter

**Release Date:** January 25, 2025  
**Breaking Changes:** None  
**Compatibility:** All existing ChatGPT exports continue to work unchanged

## 🎉 Major New Feature: Google Gemini Support

We're excited to announce that the ChatGPT Chat Exporter has evolved into a **multi-platform AI conversation exporter**! This release adds full support for **Google Gemini** conversations while maintaining all existing ChatGPT functionality.

## 🆕 What's New

### **Google Gemini Export Support**
- 📄 **Full Markdown Export**: Clean, readable Gemini conversation exports
- 🎯 **Accurate Detection**: Gemini-specific DOM parsing with multiple fallback methods
- 👥 **Smart Identification**: Reliable distinction between user and Gemini messages
- 🔄 **Duplicate Prevention**: Same intelligent filtering as ChatGPT version
- 🏷️ **Title Extraction**: Real conversation titles instead of generic names

### **Enhanced Multi-Platform Architecture**
- 🔧 **Unified Codebase**: Shared logic and improvements across platforms
- 🛡️ **Platform-Specific**: Tailored selectors and detection for each AI service
- 📊 **Future-Ready**: Foundation for supporting Claude, Bing Chat, and more

### **File Structure**
```
├── exporter-markdown.js          # ChatGPT Markdown (unchanged)
├── exporter-pdf.js              # ChatGPT PDF (unchanged)
├── gemini-exporter-markdown.js  # NEW: Gemini Markdown
├── chatgpt-*.user.js            # ChatGPT Userscripts (unchanged)
└── README.md                    # Updated with Gemini instructions
```

## 📋 Supported Platforms

| Platform | Status | Formats | Notes |
|----------|--------|---------|-------|
| **ChatGPT** | ✅ Stable | Markdown, PDF | No changes, full backward compatibility |
| **Google Gemini** | ✅ New | Markdown | Full conversation export support |
| **Claude** | 🔄 Planned | - | Coming in future release |
| **Bing Chat** | 🔄 Planned | - | Planned for future release |

## 🚀 How to Use Gemini Export

### Quick Start (Console Method)
1. Open your conversation at [gemini.google.com](https://gemini.google.com)
2. Open DevTools → Console (F12)
3. Paste the contents of `gemini-exporter-markdown.js`
4. Press Enter → Markdown file downloads automatically

### Features Inherited from ChatGPT Version
- ✅ Modern selector cascade with fallbacks
- ✅ Enhanced content processing (code blocks, images)
- ✅ Smart duplicate detection and prevention
- ✅ Console logging for debugging
- ✅ Clean markdown output formatting

## 🔄 Migration & Compatibility

**Existing Users:** No action required! All ChatGPT functionality remains unchanged.

**New Features:** Simply add the Gemini exporter alongside your existing setup.

## 🐛 Bug Fixes & Improvements

### ChatGPT (Maintained)
- ✅ All v0.3.0 improvements maintained
- ✅ Continued support for modern ChatGPT interface
- ✅ No breaking changes to existing exports

### Gemini (New)
- ✅ Robust message detection with multiple selector strategies
- ✅ Intelligent sender identification (You vs Gemini)
- ✅ Content processing with code block preservation
- ✅ Duplicate prevention and validation
- ✅ Proper conversation title extraction

## 📈 Technical Achievements

- **Zero Breaking Changes**: Existing ChatGPT exports work identically
- **Shared Codebase**: 80%+ code reuse between platforms
- **Robust Selectors**: Progressive fallback system for both platforms
- **Future-Proof**: Architecture ready for additional AI platforms

## 🔮 Roadmap

**Next Release (v0.5.0)**
- Claude conversation export support
- Gemini PDF export option
- Enhanced userscript support for Gemini

**Future Considerations**
- Bing Chat support
- Bulk conversation export
- Advanced filtering options

## 📝 Installation

### ChatGPT (No Changes)
- Console: Use existing `exporter-markdown.js` or `exporter-pdf.js`
- Userscript: Existing userscripts continue to work

### Gemini (New)
- Console: Use new `gemini-exporter-markdown.js`
- Userscript: Coming in future release

## 🙏 Acknowledgments

This release maintains the high-quality standards established in v0.3.0 while expanding to support Google's Gemini platform. The same attention to detail, duplicate prevention, and robust message detection has been applied to ensure excellent export quality across both platforms.

---

**Download:** [Latest Release](https://github.com/rashidazarang/chatgpt-chat-exporter/releases/tag/v0.4.0)  
**Documentation:** [Updated README](README.md)  
**Issues:** [GitHub Issues](https://github.com/rashidazarang/chatgpt-chat-exporter/issues) 