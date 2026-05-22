// ==UserScript==
// @name         ChatGPT Chat Exporter - PDF
// @namespace    https://github.com/rashidazarang/chatgpt-chat-exporter
// @version      0.6.0
// @description  Export ChatGPT conversations to PDF-ready HTML format
// @author       rashidazarang
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://chatgpt.com/c/*
// @grant        none
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';
    
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function cleanText(text) {
        return text
            .replace(/&/g, '&amp;')  // Replace & first to avoid double-escaping
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .trim();
    }

    function getText(element) {
        return (element?.innerText ?? element?.textContent ?? '').trim();
    }

    function extractCodeBlock(pre) {
        const codeEl = pre.querySelector('code');
        const langMatch = codeEl?.className?.match(/language-([a-zA-Z0-9_-]+)/);
        let lang = langMatch ? langMatch[1] : '';

        if (!lang) {
            const header = pre.querySelector('[class*="sticky"], [class*="code-header"], [data-testid*="code-block"]');
            const headerText = getText(header).replace(/\b(copy|code|download)\b/gi, '').trim();
            if (headerText && headerText.length < 30 && !headerText.includes('\n')) {
                lang = headerText.toLowerCase();
            }
            header?.remove();
        }

        const cmContent = pre.querySelector('.cm-content');
        if (cmContent) {
            const cmLines = cmContent.querySelectorAll('.cm-line');
            if (cmLines.length > 0) {
                return { lang, code: Array.from(cmLines).map(line => line.textContent).join('\n').trim() };
            }

            cmContent.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            return { lang, code: cmContent.textContent.trim() };
        }

        return { lang, code: getText(codeEl || pre) };
    }

    function addReplacement(replacements, html) {
        const marker = `EXPORTER_BLOCK_${replacements.length}`;
        replacements.push({ marker, html });
        return marker;
    }

    function processCodeBlocks(clone, replacements) {
        clone.querySelectorAll('pre').forEach(pre => {
            const { lang, code } = extractCodeBlock(pre);
            const label = lang ? `<div class="code-language">${cleanText(lang)}</div>` : '';
            const html = `<pre class="code-block">${label}<code>${cleanText(code)}</code></pre>`;
            pre.replaceWith(document.createTextNode(addReplacement(replacements, html)));
        });
    }

    function processMath(clone) {
        const processed = new Set();

        clone.querySelectorAll('annotation[encoding*="tex"]').forEach(annotation => {
            const tex = annotation.textContent.trim();
            if (!tex) return;

            const displayRoot = annotation.closest('.katex-display, mjx-container[display="true"], [display="block"]');
            const mathRoot = displayRoot || annotation.closest('.katex, mjx-container, math');
            if (!mathRoot || processed.has(mathRoot)) return;

            processed.add(mathRoot);
            mathRoot.replaceWith(document.createTextNode(displayRoot ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
        });

        clone.querySelectorAll('script[type^="math/tex"]').forEach(script => {
            const tex = script.textContent.trim();
            if (!tex) return;
            const isDisplay = /mode=display/.test(script.type);
            script.replaceWith(document.createTextNode(isDisplay ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
        });
    }

    function processMedia(clone) {
        clone.querySelectorAll('img, canvas, video, audio').forEach(el => {
            const tag = el.tagName.toLowerCase();
            const alt = el.getAttribute('alt') || el.getAttribute('aria-label') || '';
            const label = tag === 'img' && alt ? `[Image: ${alt}]` :
                tag === 'canvas' ? '[Canvas or chart]' :
                tag === 'video' ? '[Video]' :
                tag === 'audio' ? '[Audio]' :
                '[Media]';
            el.replaceWith(document.createTextNode(label));
        });
    }

    function processLinks(clone, replacements) {
        clone.querySelectorAll('a[href]').forEach(link => {
            if (link.closest('pre, code')) return;

            const href = (link.href || '').trim();
            const lowerHref = href.toLowerCase();
            if (!href || lowerHref.startsWith('javascript:') || lowerHref.startsWith('data:') || lowerHref.startsWith('vbscript:') || href.startsWith('#')) return;

            const text = link.textContent.replace(/\s+/g, ' ').trim() || href;
            const html = `<a href="${cleanText(href)}">${cleanText(text)}</a>`;
            link.replaceWith(document.createTextNode(addReplacement(replacements, html)));
        });
    }

    function tableToHtml(table) {
        const rows = Array.from(table.querySelectorAll('tr'))
            .map(row => Array.from(row.children)
                .filter(cell => ['TH', 'TD'].includes(cell.tagName))
                .map(cell => ({ tag: cell.tagName.toLowerCase(), text: getText(cell).replace(/\s+/g, ' ') })))
            .filter(cells => cells.length > 0);

        if (rows.length === 0) return cleanText(getText(table));

        const renderedRows = rows.map(cells => {
            const renderedCells = cells.map(cell => `<${cell.tag}>${cleanText(cell.text)}</${cell.tag}>`).join('');
            return `<tr>${renderedCells}</tr>`;
        }).join('');

        return `<table>${renderedRows}</table>`;
    }

    function processTables(clone, replacements) {
        clone.querySelectorAll('table').forEach(table => {
            table.replaceWith(document.createTextNode(addReplacement(replacements, tableToHtml(table))));
        });
    }

    function restoreReplacements(html, replacements) {
        return replacements.reduce((result, replacement) => result.replaceAll(replacement.marker, replacement.html), html);
    }

    function findMessages() {
        const selectors = [
            'div[data-message-author-role]',
            'article[data-testid*="conversation-turn"]',
            'div[data-testid="conversation-turn"]',
            '.group\\/conversation-turn',
            'div[class*="group"]:not([class*="group"] [class*="group"])'
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`PDF: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`PDF: Fallback: found ${messages.length} potential messages`);
            }
        }

        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();
            return text.length >= 30 && text.length <= 100000;
        });

        const consolidatedMessages = [];
        const usedElements = new Set();

        validMessages.forEach(msg => {
            if (usedElements.has(msg)) return;
            
            const isNested = validMessages.some(other => 
                other !== msg && other.contains(msg) && !usedElements.has(other)
            );
            
            if (!isNested) {
                consolidatedMessages.push(msg);
                usedElements.add(msg);
            }
        });

        return consolidatedMessages;
    }

    function identifySender(messageElement, index) {
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            if (alt.includes('user')) return 'You';
            if (alt.includes('chatgpt') || alt.includes('assistant')) return 'ChatGPT';
        }

        return index % 2 === 0 ? 'You' : 'ChatGPT';
    }

    function processMessageContent(element) {
        const clone = element.cloneNode(true);
        const replacements = [];

        // Do NOT use [class*="edit"]: it matches CodeMirror's "cm-editor" wrapper.
        clone.querySelectorAll('button, svg, [class*="regenerate"], [data-testid*="copy"], [aria-label*="Copy"], [aria-label*="copy"]').forEach(el => el.remove());
        processCodeBlocks(clone, replacements);
        processMath(clone);
        processMedia(clone);
        processLinks(clone, replacements);
        processTables(clone, replacements);

        const html = cleanText(getText(clone)).replace(/\n/g, '<br>');
        return restoreReplacements(html, replacements);
    }

    function extractTitle() {
        const titleSelectors = [
            'h1:not([class*="hidden"])',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent.trim();
                if (!['chatgpt', 'new chat', 'untitled'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }
        
        const docTitle = document.title;
        if (docTitle && !docTitle.toLowerCase().includes('chatgpt')) {
            return docTitle;
        }
        
        return 'ChatGPT Conversation';
    }

    function exportToPDF() {
        const messages = findMessages();
        
        if (messages.length === 0) {
            alert('No messages found. The page structure may have changed.');
            return;
        }

        console.log(`PDF: Processing ${messages.length} messages...`);

        const title = extractTitle();
        const date = formatDate();
        const url = window.location.href;

        // Create HTML content optimized for PDF printing
        let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${cleanText(title)}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .message { page-break-inside: avoid; }
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        
        .metadata {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .message {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            page-break-inside: avoid;
        }
        
        .message.user {
            background: #e3f2fd;
            margin-left: 40px;
        }
        
        .message.assistant {
            background: #f3f4f6;
            margin-right: 40px;
        }
        
        .sender {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .content {
            color: #333;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .code-block {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: "Courier New", monospace;
            font-size: 14px;
            margin: 10px 0;
        }

        .code-block code {
            white-space: pre;
        }

        .code-language {
            color: #d7dae0;
            font-size: 12px;
            margin-bottom: 8px;
            text-transform: uppercase;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 14px;
        }

        th, td {
            border: 1px solid #d9dde3;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }

        th {
            background: #eef2f7;
        }
        
        .instructions {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .instructions h3 {
            margin-top: 0;
            color: #856404;
        }
        
        @media screen {
            .instructions {
                position: sticky;
                top: 20px;
                z-index: 1000;
            }
        }
    </style>
</head>
<body>
    <div class="instructions no-print">
        <h3>📄 Convert to PDF</h3>
        <ol>
            <li>Press <strong>Ctrl+P</strong> (Windows/Linux) or <strong>Cmd+P</strong> (Mac)</li>
            <li>Set "Destination" to <strong>"Save as PDF"</strong></li>
            <li>Choose your preferred settings (recommend "Letter" or "A4" size)</li>
            <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><em>This instruction box will not appear in the PDF.</em></p>
    </div>

    <h1>${cleanText(title)}</h1>
    
    <div class="metadata">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Source:</strong> <a href="${url}">${url}</a></p>
        <p><strong>Messages:</strong> ${messages.length}</p>
    </div>
    
    <div class="conversation">`;

        // Process messages
        const seenContent = new Set();
        let processedCount = 0;

        messages.forEach((messageElement, index) => {
            const sender = identifySender(messageElement, index);
            const content = processMessageContent(messageElement);
            
            if (!content || content.replace(/<[^>]*>/g, '').trim().length < 10) return;
            
            const contentHash = content.replace(/<[^>]*>/g, ' ').substring(0, 100).replace(/\s+/g, ' ');
            if (seenContent.has(contentHash)) return;
            seenContent.add(contentHash);
            
            const senderClass = sender.toLowerCase() === 'you' ? 'user' : 'assistant';
            
            htmlContent += `
        <div class="message ${senderClass}">
            <div class="sender">${cleanText(sender)}</div>
            <div class="content">${content}</div>
        </div>`;
            
            processedCount++;
        });

        htmlContent += `
    </div>
</body>
</html>`;

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url2 = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url2;
        const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
        a.download = safeTitle ? `${safeTitle} (${date}) - PrintToPDF.html` : `ChatGPT_Conversation_${date}_PrintToPDF.html`;
        
        // Auto-download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);

        console.log(`PDF: Export completed - ${processedCount} messages processed`);
        console.log('PDF: The HTML file has been downloaded. Open it and press Ctrl+P (Cmd+P on Mac) to save as PDF.');
        
        // Show instructions
        alert(`✅ Export Complete!\n\n${processedCount} messages exported.\n\nTo create PDF:\n1. Open the downloaded HTML file\n2. Press Ctrl+P (Cmd+P on Mac)\n3. Choose "Save as PDF"\n4. Click Save\n\nThe yellow instruction box will not appear in the PDF.`);
    }

    // Add export button to the page
    function addExportButton() {
        // Check if button already exists
        if (document.querySelector('#chatgpt-export-pdf-btn')) return;

        const button = document.createElement('button');
        button.id = 'chatgpt-export-pdf-btn';
        button.textContent = 'Export as PDF';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 180px;
            padding: 10px 20px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('click', exportToPDF);
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#2c7fb8';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#3498db';
        });
        
        document.body.appendChild(button);
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExportButton);
    } else {
        // Add button after a short delay to ensure page is fully loaded
        setTimeout(addExportButton, 1000);
    }

    // Re-add button if navigation changes (for SPAs)
    const observer = new MutationObserver(() => {
        if (!document.querySelector('#chatgpt-export-pdf-btn')) {
            addExportButton();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();
