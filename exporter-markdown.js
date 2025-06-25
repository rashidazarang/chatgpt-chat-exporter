(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function cleanMarkdown(text) {
        return text
            // Only escape backslashes that aren't already escaping something
            .replace(/\\(?![\\*_`])/g, '\\\\')
            // Clean up excessive newlines
            .replace(/\n{3,}/g, '\n\n')
            // Remove any HTML entities that might have leaked through
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    }

    function processMessageContent(element) {
        const clone = element.cloneNode(true);

        // Replace <pre><code> blocks with proper markdown
        clone.querySelectorAll('pre').forEach(pre => {
            const code = pre.innerText.trim();
            const langMatch = pre.querySelector('code')?.className?.match(/language-([a-zA-Z0-9]+)/);
            const lang = langMatch ? langMatch[1] : '';
            // Create a text node instead of replacing with string to avoid HTML parsing issues
            const codeBlock = document.createTextNode(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
            pre.parentNode.replaceChild(codeBlock, pre);
        });

        // Replace images and canvas with placeholders
        clone.querySelectorAll('img, canvas').forEach(el => {
            const placeholder = document.createTextNode('[Image or Canvas]');
            el.parentNode.replaceChild(placeholder, el);
        });

        // Convert remaining HTML to clean markdown text
        return cleanMarkdown(clone.innerText.trim());
    }

    function findMessages() {
        // Try modern selectors first, fall back to legacy
        const selectors = [
            'div[data-message-author-role]', // Modern ChatGPT
            'div[data-testid*="conversation-turn"]', // Potential new structure  
            'div[data-testid*="message"]', // Alternative message selector
            'article', // Semantic structure
            'div[class*="group"]' // Legacy fallback
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`Using selector: ${selector}, found ${messages.length} messages`);
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

        return 'Conversation with ChatGPT';
    }

    // Main export logic
    const messages = findMessages();
    const lines = [];

    const title = extractConversationTitle();
    const date = formatDate();
    const url = window.location.href;

    lines.push(`# ${title}\n`);
    lines.push(`**Date:** ${date}`);
    lines.push(`**Source:** [chat.openai.com](${url})\n`);
    lines.push(`---\n`);

    // Track previous message to avoid duplicates and fix sender sequence
    let previousContent = '';
    let previousSender = '';
    let processedCount = 0;

    messages.forEach((messageElement, index) => {
        const sender = identifySender(messageElement, index);
        
        // Find content within message
        const contentSelectors = [
            '.markdown', '.prose', '.whitespace-pre-wrap', // Legacy
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

        const content = processMessageContent(contentElement);
        
        // Skip empty messages or exact duplicates
        if (!content || content === previousContent) {
            return;
        }

        // Skip if content is too short (likely UI elements, not actual messages)
        if (content.trim().length < 20) {
            return;
        }

        // Fix sender alternation if we have consecutive messages from same sender
        let finalSender = sender;
        if (previousSender && previousSender === sender && processedCount > 0) {
            // Likely missed a message in between, use opposite sender
            finalSender = previousSender === 'You' ? 'ChatGPT' : 'You';
            console.log(`Fixed consecutive ${sender} messages at index ${index}`);
        }

        lines.push(`### **${finalSender}**\n`);
        lines.push(content);
        lines.push('\n---\n');
        
        previousContent = content;
        previousSender = finalSender;
        processedCount++;
    });

    console.log(`Processed ${processedCount} unique messages from ${messages.length} detected elements`);

    const markdown = lines.join('\n').trim();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.download = `ChatGPT_Conversation_${date}.md`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
})();