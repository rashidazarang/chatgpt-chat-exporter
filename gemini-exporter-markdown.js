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

        // Remove UI elements that shouldn't be in the export
        clone.querySelectorAll('button, svg, [class*="copy"], [class*="edit"], [class*="regenerate"], [class*="more"], [aria-label*="copy"]').forEach(el => el.remove());

        // Replace <pre><code> blocks with proper markdown
        clone.querySelectorAll('pre').forEach(pre => {
            const code = pre.innerText.trim();
            const langMatch = pre.querySelector('code')?.className?.match(/language-([a-zA-Z0-9]+)/);
            const lang = langMatch ? langMatch[1] : '';
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
        // Gemini-specific selectors
        const selectors = [
            '[data-test-id="conversation-turn"]', // Gemini conversation turns
            '[class*="conversation-turn"]', // Alternative conversation turn class
            'model-response', // Gemini response elements
            '[role="presentation"] > div', // Message containers
            '.conversation-container > div', // Direct children of conversation
            '[class*="message"]', // Generic message containers
            'div[class*="turn"]:not([class*="turn"] [class*="turn"])', // Top-level turns only
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
            const conversationContainer = document.querySelector(
                '[role="main"], main, .conversation, [class*="conversation"], [class*="chat"]'
            );
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
        // Method 1: Check for Gemini-specific data attributes
        const modelRole = messageElement.getAttribute('data-message-author-role');
        if (modelRole) {
            return modelRole === 'user' ? 'You' : 'Gemini';
        }

        // Method 2: Look for avatar images with Gemini-specific detection
        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            const classes = avatar.className?.toLowerCase() || '';
            
            // User indicators
            if (alt.includes('user') || src.includes('user') || classes.includes('user')) {
                return 'You';
            }
            
            // Gemini indicators
            if (alt.includes('gemini') || alt.includes('assistant') || alt.includes('bard') || 
                src.includes('assistant') || src.includes('gemini') || classes.includes('assistant')) {
                return 'Gemini';
            }
        }

        // Method 3: Content analysis with Gemini-specific patterns
        const text = messageElement.textContent.toLowerCase();
        const textStart = text.substring(0, 200); // Look at beginning of message
        
        // Strong Gemini indicators
        if (textStart.match(/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course|absolutely)/)) {
            return 'Gemini';
        }
        
        // Strong user indicators  
        if (textStart.match(/^(can you|please help|how do i|i need|i want|help me|could you|explain|what is)/)) {
            return 'You';
        }

        // Method 4: Structural analysis - look at DOM structure
        const hasCodeBlocks = messageElement.querySelectorAll('pre, code').length > 0;
        const hasLongText = messageElement.textContent.length > 200;
        const hasLists = messageElement.querySelectorAll('ul, ol, li').length > 0;
        
        // Gemini messages tend to be longer and more structured
        if (hasCodeBlocks && hasLongText && hasLists) {
            return 'Gemini';
        }

        // Method 5: Check for Gemini-specific CSS classes or containers
        const classes = messageElement.className?.toLowerCase() || '';
        const parentClasses = messageElement.parentElement?.className?.toLowerCase() || '';
        
        if (classes.includes('model-response') || classes.includes('assistant') ||
            parentClasses.includes('model-response') || parentClasses.includes('assistant')) {
            return 'Gemini';
        }

        // Method 6: Position-based fallback with better logic
        if (index > 0 && allMessages[index - 1]) {
            const prevText = allMessages[index - 1].textContent;
            const currentText = messageElement.textContent;
            
            // If previous was short and current is long, likely user -> assistant
            if (prevText.length < 100 && currentText.length > 300) {
                return 'Gemini';
            }
            
            // If previous was long and current is short, likely assistant -> user  
            if (prevText.length > 300 && currentText.length < 100) {
                return 'You';
            }
        }

        // Final fallback
        return index % 2 === 0 ? 'You' : 'Gemini';
    }

    function extractConversationTitle() {
        // Try to get actual conversation title for Gemini
        const titleSelectors = [
            'h1:not([class*="hidden"])',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]',
            '[aria-label*="conversation"]',
            'title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent.trim();
                // Avoid generic titles
                if (!['gemini', 'new chat', 'untitled', 'chat', 'bard'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        return 'Conversation with Gemini';
    }

    // Main export logic
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
    lines.push(`**Source:** [gemini.google.com](${url})\n`);
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
            
            // If current message is much longer, it's likely Gemini
            if (currentLength > previousLength * 2 && currentLength > 500) {
                current.sender = 'Gemini';
            } else if (previousLength > currentLength * 2 && previousLength > 500) {
                previous.sender = 'Gemini';
                current.sender = 'You';
            } else {
                // Default alternating fix
                current.sender = current.sender === 'You' ? 'Gemini' : 'You';
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
    a.download = `Gemini_Conversation_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url2);

    console.log(`Export completed: ${processedMessages.length} messages exported`);
})(); 