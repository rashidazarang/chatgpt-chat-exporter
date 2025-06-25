(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function sanitize(text) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function findMessages() {
        // Try modern selectors first, fall back to legacy
        const selectors = [
            'div[data-message-author-role]', // Modern ChatGPT
            'div[data-testid*="conversation-turn"]', // Potential new structure  
            'div[data-testid*="message"]', // Alternative message selector
            'article', // Semantic structure
            'div[class*="group"]', // Legacy fallback
            '.text-base' // Original PDF fallback
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`PDF: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        // Filter out obvious duplicates or invalid messages
        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();
            // More refined filtering
            if (text.length < 10 || text.length > 100000) return false;
            
            // Skip elements that seem like UI components
            if (msg.querySelector('button, input, textarea')) return false;
            
            // Must contain meaningful content
            return text.split(' ').length > 2;
        });

        // Remove nested messages (child messages inside parent messages)
        return validMessages.filter(msg => {
            return !validMessages.some(other => other !== msg && other.contains(msg));
        });
    }

    function identifySender(messageElement, index) {
        // Method 1: Check for data attributes (modern ChatGPT)
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        // Method 2: Look for avatar images
        const avatar = messageElement.querySelector('img[alt], img[src*="avatar"]');
        if (avatar) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            
            if (alt.includes('user') || alt.includes('you') || src.includes('user')) {
                return 'You';
            }
            if (alt.includes('chatgpt') || alt.includes('assistant') || src.includes('assistant')) {
                return 'ChatGPT';
            }
        }

        // Method 3: Text-based detection
        const text = messageElement.textContent.toLowerCase();
        if (text.includes('i understand') || text.includes('i can help') || text.includes("here's") || text.includes("i'll")) {
            return 'ChatGPT';
        }
        if (text.includes('can you') || text.includes('please help') || text.includes('how do i')) {
            return 'You';
        }

        // Method 4: Structural position (fallback - assumes alternating pattern)
        return index % 2 === 0 ? 'You' : 'ChatGPT';
    }

    function extractConversationTitle() {
        // Try to get actual conversation title
        const titleSelectors = [
            'h1',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]',
            'title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent.trim();
                // Avoid generic titles
                if (!['chatgpt', 'new chat', 'untitled'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        return 'ChatGPT Conversation';
    }

    function extractFormattedContent() {
        const messages = findMessages();
        let html = '';

        // Track previous message to avoid duplicates and fix sender sequence
        let previousContent = '';
        let previousSender = '';
        let processedCount = 0;

        messages.forEach((messageElement, index) => {
            const sender = identifySender(messageElement, index);
            
            // Find content within message
            const contentSelectors = [
                '.whitespace-pre-wrap', '.markdown', '.prose', // Legacy
                '[data-message-content]', // Modern
                'div[class*="message-content"]' // Generic
            ];
            
            let contentElement = messageElement;
            for (const selector of contentSelectors) {
                const found = messageElement.querySelector(selector);
                if (found) {
                    contentElement = found;
                    break;
                }
            }

            if (!contentElement) return;

            const clone = contentElement.cloneNode(true);

            clone.querySelectorAll('pre').forEach(pre => {
                const code = sanitize(pre.innerText.trim());
                pre.replaceWith(`<pre><code>${code}</code></pre>`);
            });

            clone.querySelectorAll('img, canvas').forEach(el => {
                el.replaceWith('[Image or Canvas]');
            });

            const cleanText = sanitize(clone.innerText.trim()).replace(/\n/g, '<br>');
            
            // Skip empty messages or exact duplicates
            if (!cleanText || cleanText === previousContent) {
                return;
            }

            // Skip if content is too short (likely UI elements, not actual messages)
            if (cleanText.trim().length < 20) {
                return;
            }

            // Fix sender alternation if we have consecutive messages from same sender
            let finalSender = sender;
            if (previousSender && previousSender === sender && processedCount > 0) {
                // Likely missed a message in between, use opposite sender
                finalSender = previousSender === 'You' ? 'ChatGPT' : 'You';
                console.log(`PDF: Fixed consecutive ${sender} messages at index ${index}`);
            }

            html += `
                <div class="message">
                    <div class="sender">${finalSender}</div>
                    <div class="content">${cleanText}</div>
                </div>
            `;

            previousContent = cleanText;
            previousSender = finalSender;
            processedCount++;
        });

        console.log(`PDF: Processed ${processedCount} unique messages from ${messages.length} detected elements`);
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
        }
        h1 {
            text-align: center;
        }
        .meta {
            font-size: 0.9rem;
            color: #555;
            margin-bottom: 2rem;
            text-align: center;
        }
        .message {
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #ddd;
        }
        .sender {
            font-weight: bold;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
        }
        pre {
            background: #f4f4f4;
            padding: 1rem;
            overflow-x: auto;
            border-radius: 5px;
            font-family: monospace;
            font-size: 0.9rem;
        }
        code {
            white-space: pre-wrap;
        }
        .content {
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta">
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Source:</strong> <a href="${source}">${source}</a></div>
    </div>
    ${conversationHTML}
    <script>
        window.onload = () => {
            window.print();
        };
    </script>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
})();
