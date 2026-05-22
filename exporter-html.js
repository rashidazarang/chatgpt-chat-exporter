(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function sanitize(text) {
        return text
            .replace(/&/g, '&amp;')  // Replace & first to avoid double-escaping
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getText(element) {
        return (element?.innerText ?? element?.textContent ?? '').trim();
    }

    function removeUiElements(clone) {
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

    function addReplacement(replacements, html) {
        const marker = `EXPORTER_BLOCK_${replacements.length}`;
        replacements.push({ marker, html });
        return marker;
    }

    function processCodeBlocks(clone, replacements) {
        clone.querySelectorAll('pre').forEach(pre => {
            const { lang, code } = extractCodeBlock(pre);
            const langClass = lang ? ` class="language-${sanitize(lang)}"` : '';
            const html = `<pre><code${langClass}>${sanitize(code)}</code></pre>`;
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
            const html = `<a href="${sanitize(href)}">${sanitize(text)}</a>`;
            link.replaceWith(document.createTextNode(addReplacement(replacements, html)));
        });
    }

    function tableToHtml(table) {
        const rows = Array.from(table.querySelectorAll('tr'))
            .map(row => Array.from(row.children)
                .filter(cell => ['TH', 'TD'].includes(cell.tagName))
                .map(cell => ({ tag: cell.tagName.toLowerCase(), text: getText(cell).replace(/\s+/g, ' ') })))
            .filter(cells => cells.length > 0);

        if (rows.length === 0) return sanitize(getText(table));

        const renderedRows = rows.map(cells => {
            const renderedCells = cells.map(cell => `<${cell.tag}>${sanitize(cell.text)}</${cell.tag}>`).join('');
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

    function processMessageContent(element) {
        const clone = element.cloneNode(true);
        const replacements = [];

        removeUiElements(clone);
        processCodeBlocks(clone, replacements);
        processMath(clone);
        processMedia(clone);
        processLinks(clone, replacements);
        processTables(clone, replacements);

        const html = sanitize(getText(clone)).replace(/\n/g, '<br>');
        return restoreReplacements(html, replacements);
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
                console.log(`HTML: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            // Fallback: try to find conversation container and parse its structure
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                // Look for direct children that seem like message containers
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`HTML: Fallback: found ${messages.length} potential messages in conversation container`);
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
            console.log('HTML: No messages found. The page structure may have changed.');
            return '<div class="message"><div class="content">No messages found.</div></div>';
        }

        console.log(`HTML: Processing ${messages.length} messages...`);

        // Process messages with better duplicate detection
        const processedMessages = [];
        const seenContent = new Set();

        messages.forEach((messageElement, index) => {
            const sender = identifySender(messageElement, index, messages);
            const cleanText = processMessageContent(messageElement);
            
            // Skip if empty or too short
            if (!cleanText || cleanText.replace(/<[^>]*>/g, '').trim().length < 30) {
                console.log(`HTML: Skipping message ${index}: too short or empty`);
                return;
            }

            // Create a content hash for duplicate detection
            const contentHash = cleanText.substring(0, 100).replace(/\s+/g, ' ').trim();
            if (seenContent.has(contentHash)) {
                console.log(`HTML: Skipping message ${index}: duplicate content`);
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
                
                console.log(`HTML: Fixed consecutive ${previous.sender} messages at positions ${i-1} and ${i}`);
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

        console.log(`HTML: Export completed: ${processedMessages.length} messages exported`);
        return html;
    }

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
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        th, td {
            border: 1px solid #d9dde3;
            padding: 0.5rem;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #eef2f7;
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
    // Use document title for better file naming (Issue #12)
    const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    a.download = safeTitle ? `${safeTitle} (${date}).html` : `ChatGPT_Conversation_${date}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
})();
