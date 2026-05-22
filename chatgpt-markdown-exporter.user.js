// ==UserScript==
// @name         ChatGPT Chat Exporter - Markdown
// @namespace    https://github.com/rashidazarang/chatgpt-chat-exporter
// @version      0.6.0
// @description  Export ChatGPT conversations to Markdown format
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

    function cleanMarkdown(text) {
        return text
            // Clean up excessive newlines
            .replace(/\n{3,}/g, '\n\n')
            // Remove any HTML entities that might have leaked through
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    function getText(element) {
        return (element?.innerText ?? element?.textContent ?? '').trim();
    }

    function removeUiElements(clone) {
        // Remove UI elements that shouldn't be in the export.
        // Do NOT use [class*="edit"]: it matches CodeMirror's "cm-editor" wrapper
        // that holds the actual code in modern ChatGPT, and would erase code blocks.
        clone.querySelectorAll('button, svg, [class*="regenerate"], [data-testid*="copy"], [aria-label*="Copy"], [aria-label*="copy"]').forEach(el => el.remove());
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

    function processCodeBlocks(clone) {
        clone.querySelectorAll('pre').forEach(pre => {
            const { lang, code } = extractCodeBlock(pre);
            const codeBlock = document.createTextNode(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
            pre.parentNode.replaceChild(codeBlock, pre);
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
            const wrapper = displayRoot ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
            mathRoot.replaceWith(document.createTextNode(wrapper));
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
            const placeholder = document.createTextNode(label);
            el.parentNode.replaceChild(placeholder, el);
        });
    }

    function processLinks(clone) {
        clone.querySelectorAll('a[href]').forEach(link => {
            if (link.closest('pre, code')) return;

            const href = (link.href || '').trim();
            const lowerHref = href.toLowerCase();
            if (!href || lowerHref.startsWith('javascript:') || lowerHref.startsWith('data:') || lowerHref.startsWith('vbscript:') || href.startsWith('#')) return;

            const text = link.textContent.replace(/\s+/g, ' ').trim() || href;
            const escapedText = text
                .replace(/\\/g, '\\\\')
                .replace(/([\[\]])/g, '\\$1');
            const safeHref = href
                .replace(/\\/g, '%5C')
                .replace(/\)/g, '%29');
            const markdown = `[${escapedText}](${safeHref})`;
            link.parentNode.replaceChild(document.createTextNode(markdown), link);
        });
    }

    function tableCellText(cell) {
        return getText(cell).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim() || ' ';
    }

    function tableToMarkdown(table) {
        const rows = Array.from(table.querySelectorAll('tr'))
            .map(row => Array.from(row.children)
                .filter(cell => ['TH', 'TD'].includes(cell.tagName))
                .map(tableCellText))
            .filter(cells => cells.length > 0);

        if (rows.length === 0) return getText(table);

        const width = Math.max(...rows.map(row => row.length));
        const normalizedRows = rows.map(row => row.concat(Array(Math.max(0, width - row.length)).fill(' ')));
        const header = normalizedRows[0];
        const separator = header.map(() => '---');
        const body = normalizedRows.slice(1);
        const lines = [
            `| ${header.join(' | ')} |`,
            `| ${separator.join(' | ')} |`,
            ...body.map(row => `| ${row.join(' | ')} |`)
        ];

        return `\n\n${lines.join('\n')}\n\n`;
    }

    function processTables(clone) {
        clone.querySelectorAll('table').forEach(table => {
            table.replaceWith(document.createTextNode(tableToMarkdown(table)));
        });
    }

    function processMessageContent(element) {
        const clone = element.cloneNode(true);

        removeUiElements(clone);
        processCodeBlocks(clone);
        processMath(clone);
        processMedia(clone);
        processLinks(clone);
        processTables(clone);

        // Convert remaining HTML to clean markdown text
        return cleanMarkdown(getText(clone));
    }

    function findMessages() {
        // More specific selectors to avoid nested elements
        const selectors = [
            'div[data-message-author-role]', // Modern ChatGPT with clear author role
            'article[data-testid*="conversation-turn"]', // Conversation turns
            'div[data-testid="conversation-turn"]', // Specific conversation turn
            '.group\\/conversation-turn', // Fix for issue #6: More specific selector for conversation turns
            'div[class*="group"]:not([class*="group"] [class*="group"])', // Top-level groups only
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            // Fallback: try to find conversation container and parse its structure
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                // Look for direct children that seem like message containers
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`Fallback: found ${messages.length} potential messages in conversation container`);
            }
        }

        // Filter and validate messages
        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();
            
            // Must have substantial content
            if (text.length < 30) return false;
            if (text.length > 100000) return false;
            
            // Skip elements that are clearly UI components
            if (msg.querySelector('input[type="text"], textarea')) return false;
            if (msg.classList.contains('typing') || msg.classList.contains('loading')) return false;
            
            // Must contain meaningful content (not just buttons/UI)
            const meaningfulText = text.replace(/\s+/g, ' ').trim();
            if (meaningfulText.split(' ').length < 5) return false;
            
            return true;
        });

        // Remove nested messages and consolidate content
        const consolidatedMessages = [];
        const usedElements = new Set();

        validMessages.forEach(msg => {
            if (usedElements.has(msg)) return;
            
            // Check if this message is nested within another valid message
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

    function identifySender(messageElement, index, allMessages) {
        // Method 1: Check for data attributes (most reliable)
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        // Method 2: Look for avatar images with better detection
        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            const classes = avatar.className?.toLowerCase() || '';
            
            // User indicators
            if (alt.includes('user') || src.includes('user') || classes.includes('user')) {
                return 'You';
            }
            
            // Assistant indicators
            if (alt.includes('chatgpt') || alt.includes('assistant') || alt.includes('gpt') || 
                src.includes('assistant') || src.includes('chatgpt') || classes.includes('assistant')) {
                return 'ChatGPT';
            }
        }

        // Method 3: Content analysis with better patterns
        const text = messageElement.textContent.toLowerCase();
        const textStart = text.substring(0, 200); // Look at beginning of message
        
        // Strong ChatGPT indicators
        if (textStart.match(/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course)/)) {
            return 'ChatGPT';
        }
        
        // Strong user indicators  
        if (textStart.match(/^(can you|please help|how do i|i need|i want|help me|could you)/)) {
            return 'You';
        }

        // Method 4: Structural analysis - look at DOM structure
        const hasCodeBlocks = messageElement.querySelectorAll('pre, code').length > 0;
        const hasLongText = messageElement.textContent.length > 200;
        const hasLists = messageElement.querySelectorAll('ul, ol, li').length > 0;
        
        // ChatGPT messages tend to be longer and more structured
        if (hasCodeBlocks && hasLongText && hasLists) {
            return 'ChatGPT';
        }

        // Method 5: Position-based fallback with better logic
        // Try to detect actual alternating pattern by looking at content characteristics
        if (index > 0 && allMessages[index - 1]) {
            const prevText = allMessages[index - 1].textContent;
            const currentText = messageElement.textContent;
            
            // If previous was short and current is long, likely user -> assistant
            if (prevText.length < 100 && currentText.length > 300) {
                return 'ChatGPT';
            }
            
            // If previous was long and current is short, likely assistant -> user  
            if (prevText.length > 300 && currentText.length < 100) {
                return 'You';
            }
        }

        // Final fallback
        return index % 2 === 0 ? 'You' : 'ChatGPT';
    }

    function extractConversationTitle() {
        // Try to get actual conversation title
        const titleSelectors = [
            'h1:not([class*="hidden"])',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]',
            'title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent.trim();
                // Avoid generic titles
                if (!['chatgpt', 'new chat', 'untitled', 'chat'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        return 'Conversation with ChatGPT';
    }

    function exportToMarkdown() {
        const messages = findMessages();
        
        if (messages.length === 0) {
            alert('No messages found. The page structure may have changed.');
            return;
        }

        console.log(`Processing ${messages.length} messages...`);

        const lines = [];
        const title = extractConversationTitle();
        const date = formatDate();
        const url = window.location.href;

        lines.push(`# ${title}\n`);
        lines.push(`**Date:** ${date}`);
        lines.push(`**Source:** [chat.openai.com](${url})\n`);
        lines.push(`---\n`);

        // Process messages with better duplicate detection
        const processedMessages = [];
        const seenContent = new Set();

        messages.forEach((messageElement, index) => {
            const sender = identifySender(messageElement, index, messages);
            const content = processMessageContent(messageElement);
            
            // Skip if empty or too short
            if (!content || content.trim().length < 30) {
                console.log(`Skipping message ${index}: too short or empty`);
                return;
            }

            // Create a content hash for duplicate detection
            const contentHash = content.substring(0, 100).replace(/\s+/g, ' ').trim();
            if (seenContent.has(contentHash)) {
                console.log(`Skipping message ${index}: duplicate content`);
                return;
            }
            seenContent.add(contentHash);

            processedMessages.push({
                sender,
                content,
                originalIndex: index
            });
        });

        // Apply sender sequence correction
        for (let i = 1; i < processedMessages.length; i++) {
            const current = processedMessages[i];
            const previous = processedMessages[i - 1];
            
            // If we have two consecutive messages from the same sender, try to fix it
            if (current.sender === previous.sender) {
                // Use content analysis to determine which should be flipped
                const currentLength = current.content.length;
                const previousLength = previous.content.length;
                
                // If current message is much longer, it's likely ChatGPT
                if (currentLength > previousLength * 2 && currentLength > 500) {
                    current.sender = 'ChatGPT';
                } else if (previousLength > currentLength * 2 && previousLength > 500) {
                    previous.sender = 'ChatGPT';
                    current.sender = 'You';
                } else {
                    // Default alternating fix
                    current.sender = current.sender === 'You' ? 'ChatGPT' : 'You';
                }
                
                console.log(`Fixed consecutive ${previous.sender} messages at positions ${i-1} and ${i}`);
            }
        }

        // Generate final output
        processedMessages.forEach(({ sender, content }) => {
            lines.push(`### **${sender}**\n`);
            lines.push(content);
            lines.push('\n---\n');
        });

        // Create and download file
        const markdownContent = lines.join('\n');
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        // Use document title for better file naming (Issue #12)
        const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
        a.download = safeTitle ? `${safeTitle} (${date}).md` : `ChatGPT_Conversation_${date}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);

        console.log(`Export completed: ${processedMessages.length} messages exported`);
    }

    // Add export button to the page
    function addExportButton() {
        // Check if button already exists
        if (document.querySelector('#chatgpt-export-markdown-btn')) return;

        const button = document.createElement('button');
        button.id = 'chatgpt-export-markdown-btn';
        button.textContent = 'Export as Markdown';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #10a37f;
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
        
        button.addEventListener('click', exportToMarkdown);
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#0d8f6e';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#10a37f';
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
        if (!document.querySelector('#chatgpt-export-markdown-btn')) {
            addExportButton();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();
