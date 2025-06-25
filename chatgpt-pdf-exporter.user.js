// ==UserScript==
// @name         ChatGPT Chat Exporter - PDF
// @namespace    https://github.com/rashidazarang/chatgpt-chat-exporter
// @version      1.1.0
// @description  Export your ChatGPT conversations as printable PDF files with improved accuracy
// @author       Rashid Azarang
// @match        https://chat.openai.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/rashidazarang/chatgpt-chat-exporter
// @supportURL   https://github.com/rashidazarang/chatgpt-chat-exporter/issues
// ==/UserScript==

(function() {
    'use strict';

    // Add a button to the ChatGPT interface
    function addExportButton() {
        // Check if our button already exists
        if (document.getElementById('export-pdf-button')) return;

        // Find a suitable location to add the button
        const targetElement = document.querySelector('nav');
        if (!targetElement) return;

        // Create the button
        const button = document.createElement('button');
        button.id = 'export-pdf-button';
        button.innerHTML = 'Export as PDF';
        button.style.cssText = `
            margin: 10px;
            padding: 10px;
            border-radius: 5px;
            background-color: #10a37f;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            width: calc(100% - 20px);
        `;

        // Add click event listener
        button.addEventListener('click', exportPDF);

        // Add button to the page
        targetElement.appendChild(button);
    }

    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function sanitize(text) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function findMessages() {
        // More specific selectors to avoid nested elements
        const selectors = [
            'div[data-message-author-role]', // Modern ChatGPT with clear author role
            'article[data-testid*="conversation-turn"]', // Conversation turns
            'div[data-testid="conversation-turn"]', // Specific conversation turn
            'div[class*="group"]:not([class*="group"] [class*="group"])', // Top-level groups only
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`PDF UserScript: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            // Fallback: try to find conversation container and parse its structure
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                // Look for direct children that seem like message containers
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`PDF UserScript: Fallback: found ${messages.length} potential messages in conversation container`);
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

        return 'ChatGPT Conversation';
    }

    function extractFormattedContent() {
        const messages = findMessages();
        
        if (messages.length === 0) {
            console.log('PDF UserScript: No messages found. The page structure may have changed.');
            return '<div class="message"><div class="content">No messages found.</div></div>';
        }

        console.log(`PDF UserScript: Processing ${messages.length} messages...`);

        // Process messages with better duplicate detection
        const processedMessages = [];
        const seenContent = new Set();

        messages.forEach((messageElement, index) => {
            const sender = identifySender(messageElement, index, messages);
            
            // Remove UI elements that shouldn't be in the export
            const clone = messageElement.cloneNode(true);
            clone.querySelectorAll('button, svg, [class*="copy"], [class*="edit"], [class*="regenerate"]').forEach(el => el.remove());

            clone.querySelectorAll('pre').forEach(pre => {
                const code = sanitize(pre.innerText.trim());
                pre.replaceWith(`<pre><code>${code}</code></pre>`);
            });

            clone.querySelectorAll('img, canvas').forEach(el => {
                el.replaceWith('[Image or Canvas]');
            });

            const cleanText = sanitize(clone.innerText.trim()).replace(/\n/g, '<br>');
            
            // Skip if empty or too short
            if (!cleanText || cleanText.trim().length < 30) {
                console.log(`PDF UserScript: Skipping message ${index}: too short or empty`);
                return;
            }

            // Create a content hash for duplicate detection
            const contentHash = cleanText.substring(0, 100).replace(/\s+/g, ' ').trim();
            if (seenContent.has(contentHash)) {
                console.log(`PDF UserScript: Skipping message ${index}: duplicate content`);
                return;
            }
            seenContent.add(contentHash);

            processedMessages.push({
                sender,
                content: cleanText,
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
                
                console.log(`PDF UserScript: Fixed consecutive ${previous.sender} messages at positions ${i-1} and ${i}`);
            }
        }

        // Generate HTML output
        let html = '';
        processedMessages.forEach(({ sender, content }) => {
            html += `
                <div class="message">
                    <div class="sender">${sender}</div>
                    <div class="content">${content}</div>
                </div>
            `;
        });

        console.log(`PDF UserScript: Export completed: ${processedMessages.length} messages exported`);
        return html;
    }

    function exportPDF() {
        const date = formatDate();
        const source = window.location.href;
        const title = extractConversationTitle();
        const conversationHTML = extractFormattedContent();

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title} - ${date}</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: auto;
            padding: 2rem;
            background: #fff;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #eee;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .metadata {
            color: #666;
            font-size: 0.9rem;
        }
        .message {
            margin-bottom: 1.5rem;
            padding: 1rem;
            border-radius: 8px;
            background: #f8f9fa;
        }
        .sender {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        pre {
            background: #f4f4f4;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            border-left: 4px solid #007acc;
        }
        code {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9rem;
        }
        @media print {
            body { margin: 0; padding: 1rem; }
            .message { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div class="metadata">
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Source:</strong> <a href="${source}">chat.openai.com</a></div>
        </div>
    </div>
    
    <div class="conversation">
        ${conversationHTML}
    </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ChatGPT_Conversation_${date}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Add the export button when the DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExportButton);
    } else {
        addExportButton();
    }

    // Check periodically if the button needs to be added (for SPAs like ChatGPT)
    setInterval(addExportButton, 3000);
})(); 