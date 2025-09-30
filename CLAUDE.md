# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT Chat Exporter is a browser-based tool for exporting ChatGPT and Google Gemini conversations to Markdown or PDF format. The project uses pure JavaScript that runs directly in the browser console or as userscripts.

## Architecture

### Core Modules (`/core/`)
- **dom-analyzer.js**: Analyzes DOM structure using multiple selector strategies (data attributes, ARIA roles, semantic HTML, content-based) to locate conversation elements
- **message-detector.js**: Unified message detection system that extracts messages, identifies senders, and processes content with formatting preservation
- **selector-cascade.js**: Implements a cascade of selector strategies for robust element detection across different ChatGPT/Gemini UI versions

### Main Exporters
- **exporter-markdown.js**: ChatGPT markdown export - processes messages and formats as clean markdown
- **exporter-pdf.js**: ChatGPT PDF export - similar to markdown but outputs as downloadable PDF
- **gemini-exporter-markdown.js**: Google Gemini markdown export with platform-specific handling

### Key Design Patterns
1. **Selector Cascade Strategy**: Uses prioritized selector strategies (data attributes → ARIA → semantic HTML → content-based) for resilient DOM element detection
2. **Confidence Scoring**: Each detection method returns confidence scores to determine reliability
3. **Multi-Strategy Sender Detection**: Identifies message senders through data attributes, avatars, textual indicators, structural patterns, and content analysis
4. **Content Processing Pipeline**: Preserves code blocks, handles media, processes links, and maintains formatting through markdown conversion

## Development Guidelines

### Testing Exporters
To test the exporters:
1. Open a ChatGPT or Gemini conversation in your browser
2. Open Developer Tools Console (F12)
3. Paste the contents of the appropriate exporter file
4. Press Enter to execute and download the export

### Selector Strategy Updates
When ChatGPT/Gemini UI changes, update selectors in this priority order:
1. Data attributes (`[data-testid*="..."]`)
2. ARIA roles (`[role="..."]`) 
3. Semantic HTML elements
4. Class-based selectors (least preferred)

### Message Detection Flow
1. DOM analysis to understand page structure
2. Find conversation container
3. Locate individual message containers
4. Extract sender, content, and metadata for each message
5. Post-process to fix detection issues
6. Calculate confidence scores

## Important Notes

- No build process required - pure JavaScript for browser execution
- Works directly from browser console or as userscripts
- Future-proof design using multiple fallback strategies
- Handles code blocks, formatting, links, and media elements
- Supports both ChatGPT and Google Gemini platforms