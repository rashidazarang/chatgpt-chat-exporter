/**
 * Unified Message Detection System - Phase 1.3 Implementation
 * Replaces inconsistent message detection logic across exporters
 */

class MessageDetector {
    constructor() {
        this.domAnalyzer = new ChatGPTDOMAnalyzer();
        this.selectorCascade = new SelectorCascade();
        this.messages = [];
        this.conversationMetadata = {};
        this.detectionConfidence = 0;
    }

    /**
     * Detect and parse all messages in the conversation
     */
    async detectMessages() {
        console.log('Starting message detection...');
        
        // Step 1: Analyze page structure
        const analysis = this.domAnalyzer.analyzePage();
        
        // Step 2: Find conversation container
        const conversationResult = this.selectorCascade.execute('conversationContainer');
        if (!conversationResult.success) {
            throw new Error('Could not find conversation container');
        }

        // Step 3: Find message containers
        const messagesResult = this.selectorCascade.execute('messageContainers');
        if (!messagesResult.success) {
            throw new Error('Could not find message containers');
        }

        // Step 4: Extract messages
        this.messages = await this.extractMessages(messagesResult.data.elements);
        
        // Step 5: Extract conversation metadata
        this.conversationMetadata = this.extractConversationMetadata();
        
        // Step 6: Calculate overall detection confidence
        this.detectionConfidence = this.calculateOverallConfidence(conversationResult, messagesResult);

        console.log(`Detected ${this.messages.length} messages with ${(this.detectionConfidence * 100).toFixed(1)}% confidence`);
        
        return {
            messages: this.messages,
            metadata: this.conversationMetadata,
            confidence: this.detectionConfidence,
            analysis
        };
    }

    /**
     * Extract individual messages from containers
     */
    async extractMessages(messageElements) {
        const messages = [];
        
        for (let i = 0; i < messageElements.length; i++) {
            try {
                const messageData = await this.extractSingleMessage(messageElements[i], i);
                if (messageData) {
                    messages.push(messageData);
                }
            } catch (error) {
                console.warn(`Failed to extract message ${i}:`, error);
                continue;
            }
        }

        // Post-process messages to fix any detection issues
        return this.postProcessMessages(messages);
    }

    /**
     * Extract a single message from its container element
     */
    async extractSingleMessage(element, index) {
        // Step 1: Identify sender
        const sender = await this.identifySender(element, index);
        
        // Step 2: Extract content
        const content = await this.extractMessageContent(element);
        
        // Step 3: Extract metadata
        const metadata = this.extractMessageMetadata(element);

        if (!content || content.trim().length === 0) {
            return null; // Skip empty messages
        }

        return {
            index,
            sender: sender.name,
            senderType: sender.type, // 'user', 'assistant', 'system'
            senderConfidence: sender.confidence,
            content,
            contentType: this.detectContentType(content),
            metadata,
            element, // Keep reference for debugging
            timestamp: metadata.timestamp || null
        };
    }

    /**
     * Identify the sender of a message using multiple strategies
     */
    async identifySender(messageElement, messageIndex) {
        // Strategy 1: Data attributes
        const dataResult = this.selectorCascade.execute('senderIdentification', {
            parentMessage: messageElement
        });

        if (dataResult.success && dataResult.data.length > 0) {
            const senderData = dataResult.data[0];
            return {
                name: this.normalizeSenderName(senderData.sender),
                type: this.classifySenderType(senderData.sender),
                confidence: senderData.confidence,
                method: 'data-attribute'
            };
        }

        // Strategy 2: Avatar detection
        const avatar = messageElement.querySelector('img[alt*="avatar"], img[alt*="user"], img[src*="avatar"]');
        if (avatar) {
            const isUser = this.isUserAvatar(avatar);
            return {
                name: isUser ? 'You' : 'ChatGPT',
                type: isUser ? 'user' : 'assistant',
                confidence: 0.8,
                method: 'avatar-detection'
            };
        }

        // Strategy 3: Textual indicators
        const textualSender = this.findTextualSender(messageElement);
        if (textualSender) {
            return textualSender;
        }

        // Strategy 4: Structural patterns (alternating)
        const structuralSender = this.inferStructuralSender(messageIndex);
        if (structuralSender) {
            return structuralSender;
        }

        // Strategy 5: Content analysis
        const contentSender = this.inferSenderFromContent(messageElement);
        return contentSender;
    }

    /**
     * Extract message content with proper formatting preservation
     */
    async extractMessageContent(messageElement) {
        // Try to find structured content first
        const contentResult = this.selectorCascade.execute('messageContent', {
            parentMessage: messageElement
        });

        let contentElement = messageElement;
        
        if (contentResult.success) {
            // Use the best content container found
            const contentContainers = Array.isArray(contentResult.data) ? contentResult.data : [contentResult.data];
            contentElement = contentContainers[0] || messageElement;
        }

        // Extract and process content
        return this.processContentElement(contentElement);
    }

    /**
     * Process content element to extract formatted text
     */
    processContentElement(element) {
        const clone = element.cloneNode(true);

        // Handle code blocks specially
        this.processCodeBlocks(clone);
        
        // Handle images and media
        this.processMedia(clone);
        
        // Handle links
        this.processLinks(clone);
        
        // Handle formatting
        this.processFormatting(clone);

        // Extract final text content
        return clone.textContent.trim();
    }

    /**
     * Process code blocks in content
     */
    processCodeBlocks(element) {
        const codeResult = this.selectorCascade.execute('codeBlocks');
        
        if (codeResult.success) {
            codeResult.data.forEach(codeBlock => {
                const { element: codeEl, language, content } = codeBlock;
                
                if (element.contains(codeEl)) {
                    const lang = language || '';
                    const placeholder = document.createTextNode(`\n\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`);
                    codeEl.parentNode.replaceChild(placeholder, codeEl);
                }
            });
        } else {
            // Fallback to simple code block processing
            element.querySelectorAll('pre, code[class*="block"]').forEach(pre => {
                const code = pre.textContent.trim();
                const langMatch = pre.querySelector('code')?.className?.match(/language-([a-zA-Z0-9]+)/);
                const lang = langMatch ? langMatch[1] : '';
                const placeholder = document.createTextNode(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`);
                pre.parentNode.replaceChild(placeholder, pre);
            });
        }
    }

    /**
     * Process media elements (images, videos, etc.)
     */
    processMedia(element) {
        // Replace images and canvas with descriptive placeholders
        element.querySelectorAll('img, canvas, video, audio').forEach(media => {
            let placeholder = '[Media]';
            
            if (media.tagName === 'IMG') {
                placeholder = media.alt ? `[Image: ${media.alt}]` : '[Image]';
            } else if (media.tagName === 'CANVAS') {
                placeholder = '[Canvas/Chart]';
            } else if (media.tagName === 'VIDEO') {
                placeholder = '[Video]';
            } else if (media.tagName === 'AUDIO') {
                placeholder = '[Audio]';
            }
            
            const textNode = document.createTextNode(placeholder);
            media.parentNode.replaceChild(textNode, media);
        });
    }

    /**
     * Process links in content
     */
    processLinks(element) {
        element.querySelectorAll('a[href]').forEach(link => {
            const text = link.textContent.trim();
            const href = link.href;
            
            // Keep links as markdown format if they're meaningful
            if (text && text !== href) {
                const linkText = `[${text}](${href})`;
                const textNode = document.createTextNode(linkText);
                link.parentNode.replaceChild(textNode, link);
            }
        });
    }

    /**
     * Process text formatting
     */
    processFormatting(element) {
        // Handle bold text
        element.querySelectorAll('strong, b').forEach(bold => {
            const text = bold.textContent;
            const textNode = document.createTextNode(`**${text}**`);
            bold.parentNode.replaceChild(textNode, bold);
        });

        // Handle italic text
        element.querySelectorAll('em, i').forEach(italic => {
            const text = italic.textContent;
            const textNode = document.createTextNode(`*${text}*`);
            italic.parentNode.replaceChild(textNode, italic);
        });

        // Handle inline code
        element.querySelectorAll('code:not(pre code)').forEach(code => {
            const text = code.textContent;
            const textNode = document.createTextNode(`\`${text}\``);
            code.parentNode.replaceChild(textNode, code);
        });
    }

    /**
     * Check if an avatar belongs to the user
     */
    isUserAvatar(avatarElement) {
        const alt = avatarElement.alt?.toLowerCase() || '';
        const src = avatarElement.src?.toLowerCase() || '';
        const className = avatarElement.className?.toLowerCase() || '';
        
        // Common patterns for user avatars
        const userPatterns = ['user', 'you', 'human', 'person'];
        const assistantPatterns = ['assistant', 'chatgpt', 'ai', 'bot'];
        
        // Check if any user patterns match
        const hasUserPattern = userPatterns.some(pattern => 
            alt.includes(pattern) || src.includes(pattern) || className.includes(pattern)
        );
        
        // Check if any assistant patterns match
        const hasAssistantPattern = assistantPatterns.some(pattern => 
            alt.includes(pattern) || src.includes(pattern) || className.includes(pattern)
        );
        
        // If both or neither match, try parent element analysis
        if (hasUserPattern && !hasAssistantPattern) return true;
        if (hasAssistantPattern && !hasUserPattern) return false;
        
        // Fallback: analyze parent structure
        return this.analyzeAvatarContext(avatarElement);
    }

    /**
     * Analyze avatar context to determine sender
     */
    analyzeAvatarContext(avatarElement) {
        // Look for textual clues near the avatar
        const parent = avatarElement.closest('[class*="message"], [class*="group"], article, section');
        if (parent) {
            const text = parent.textContent.toLowerCase();
            if (text.includes('you:') || text.includes('user:')) return true;
            if (text.includes('chatgpt:') || text.includes('assistant:')) return false;
        }
        
        // Default assumption: first message is typically user
        const messageIndex = this.getMessageIndex(avatarElement);
        return messageIndex % 2 === 0; // Even indices = user, odd = assistant
    }

    /**
     * Find textual sender indicators
     */
    findTextualSender(messageElement) {
        const text = messageElement.textContent;
        
        // Look for explicit sender labels
        const senderMatch = text.match(/^(You|ChatGPT|Assistant|System|User)[:.]?\s*/i);
        if (senderMatch) {
            const senderName = senderMatch[1];
            return {
                name: this.normalizeSenderName(senderName),
                type: this.classifySenderType(senderName),
                confidence: 0.9
            };
        }

        // Look for contextual clues
        const contextualClues = this.analyzeContextualClues(messageElement);
        if (contextualClues) {
            return contextualClues;
        }

        return null;
    }

    /**
     * Infer sender from structural patterns
     */
    inferStructuralSender(messageIndex) {
        // Simple alternating pattern: even = user, odd = assistant
        // This is a common pattern in chat interfaces
        const isUser = messageIndex % 2 === 0;
        
        return {
            name: isUser ? 'You' : 'ChatGPT',
            type: isUser ? 'user' : 'assistant',
            confidence: 0.6 // Lower confidence for structural inference
        };
    }

    /**
     * Infer sender from message content characteristics
     */
    inferSenderFromContent(messageElement) {
        const text = messageElement.textContent.toLowerCase();
        
        // Assistant-like patterns
        const assistantPatterns = [
            'i understand', 'i can help', 'here\'s', 'let me', 'i\'ll',
            'according to', 'based on', 'i think', 'in my opinion',
            'i apologize', 'i\'m sorry', 'i don\'t have', 'i cannot'
        ];
        
        // User-like patterns
        const userPatterns = [
            'can you', 'please', 'help me', 'i want', 'i need',
            'how do i', 'what is', 'explain', 'show me'
        ];
        
        const assistantScore = assistantPatterns.filter(pattern => text.includes(pattern)).length;
        const userScore = userPatterns.filter(pattern => text.includes(pattern)).length;
        
        if (assistantScore > userScore) {
            return {
                name: 'ChatGPT',
                type: 'assistant',
                confidence: Math.min(0.7, 0.4 + (assistantScore * 0.1))
            };
        } else if (userScore > assistantScore) {
            return {
                name: 'You',
                type: 'user',
                confidence: Math.min(0.7, 0.4 + (userScore * 0.1))
            };
        }
        
        // Default fallback
        return {
            name: 'Unknown',
            type: 'unknown',
            confidence: 0.3
        };
    }

    /**
     * Normalize sender names to consistent format
     */
    normalizeSenderName(senderName) {
        const name = senderName.toLowerCase().trim();
        
        if (name.includes('you') || name.includes('user') || name.includes('human')) {
            return 'You';
        }
        
        if (name.includes('chatgpt') || name.includes('assistant') || name.includes('ai')) {
            return 'ChatGPT';
        }
        
        if (name.includes('system')) {
            return 'System';
        }
        
        // Capitalize first letter for unknown senders
        return senderName.charAt(0).toUpperCase() + senderName.slice(1).toLowerCase();
    }

    /**
     * Classify sender type
     */
    classifySenderType(senderName) {
        const name = senderName.toLowerCase();
        
        if (name.includes('you') || name.includes('user') || name.includes('human')) {
            return 'user';
        }
        
        if (name.includes('chatgpt') || name.includes('assistant') || name.includes('ai')) {
            return 'assistant';
        }
        
        if (name.includes('system')) {
            return 'system';
        }
        
        return 'unknown';
    }

    /**
     * Extract conversation metadata
     */
    extractConversationMetadata() {
        return {
            title: this.extractConversationTitle(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            messageCount: this.messages.length,
            model: this.detectModel(),
            conversationId: this.extractConversationId()
        };
    }

    /**
     * Extract conversation title from page
     */
    extractConversationTitle() {
        // Try various selectors for conversation title
        const titleSelectors = [
            '[data-testid*="conversation-title"]',
            'h1', 'h2',
            '.conversation-title',
            '[class*="title"]'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim().length > 0) {
                const title = element.textContent.trim();
                // Avoid generic titles
                if (!['chatgpt', 'new chat', 'untitled'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        // Fallback to document title
        const docTitle = document.title;
        if (docTitle && !docTitle.includes('ChatGPT')) {
            return docTitle;
        }

        return 'Conversation with ChatGPT';
    }

    /**
     * Detect AI model being used
     */
    detectModel() {
        // Look for model indicators in the page
        const text = document.body.textContent.toLowerCase();
        
        const models = ['gpt-4', 'gpt-3.5', 'claude', 'dall-e'];
        for (const model of models) {
            if (text.includes(model)) {
                return model;
            }
        }
        
        return 'Unknown';
    }

    /**
     * Extract conversation ID from URL or data attributes
     */
    extractConversationId() {
        // Try URL pattern
        const urlMatch = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        // Try data attributes
        const convElement = document.querySelector('[data-conversation-id], [data-testid*="conversation"]');
        if (convElement) {
            return convElement.dataset.conversationId || convElement.dataset.testid;
        }

        return null;
    }

    /**
     * Post-process messages to fix any issues
     */
    postProcessMessages(messages) {
        // Fix alternating pattern if confidence is low
        const lowConfidenceMessages = messages.filter(msg => msg.senderConfidence < 0.7);
        
        if (lowConfidenceMessages.length > messages.length * 0.5) {
            console.warn('Many low confidence sender detections, applying pattern fix...');
            return this.applyAlternatingPattern(messages);
        }

        return messages;
    }

    /**
     * Apply alternating pattern to fix sender detection
     */
    applyAlternatingPattern(messages) {
        // Assume first message is from user (common pattern)
        let expectedSender = 'user';
        
        return messages.map((message, index) => {
            if (message.senderConfidence < 0.7) {
                message.sender = expectedSender === 'user' ? 'You' : 'ChatGPT';
                message.senderType = expectedSender;
                message.senderConfidence = 0.8; // Reasonable confidence from pattern
                message.method = 'pattern-correction';
            }
            
            // Alternate for next message
            expectedSender = expectedSender === 'user' ? 'assistant' : 'user';
            
            return message;
        });
    }

    /**
     * Calculate overall detection confidence
     */
    calculateOverallConfidence(conversationResult, messagesResult) {
        const conversationConfidence = conversationResult.success ? 0.3 : 0;
        const messagesConfidence = messagesResult.success ? 0.3 : 0;
        
        // Average sender confidence
        const avgSenderConfidence = this.messages.length > 0 
            ? this.messages.reduce((sum, msg) => sum + msg.senderConfidence, 0) / this.messages.length 
            : 0;
        
        const senderConfidence = avgSenderConfidence * 0.4;

        return Math.min(conversationConfidence + messagesConfidence + senderConfidence, 1.0);
    }

    /**
     * Detect content type of a message
     */
    detectContentType(content) {
        if (content.includes('```')) return 'code';
        if (content.includes('![') || content.includes('[Image')) return 'media';
        if (content.includes('http://') || content.includes('https://')) return 'links';
        return 'text';
    }

    /**
     * Get message index from DOM element
     */
    getMessageIndex(element) {
        const parent = element.closest('[class*="conversation"], main, [role="log"]');
        if (parent) {
            const allMessages = parent.querySelectorAll('[class*="message"], [class*="group"], article');
            return Array.from(allMessages).indexOf(element.closest('[class*="message"], [class*="group"], article'));
        }
        return 0;
    }

    /**
     * Extract message metadata
     */
    extractMessageMetadata(element) {
        return {
            timestamp: this.extractMessageTimestamp(element),
            messageId: element.dataset.messageId || null,
            editCount: this.extractEditCount(element),
            hasAttachments: this.hasAttachments(element)
        };
    }

    extractMessageTimestamp(element) { return null; } // Implementation needed
    extractEditCount(element) { return 0; } // Implementation needed
    hasAttachments(element) { return false; } // Implementation needed
    analyzeContextualClues(element) { return null; } // Implementation needed

    /**
     * Get detected messages
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Get conversation metadata
     */
    getMetadata() {
        return this.conversationMetadata;
    }

    /**
     * Get detection confidence
     */
    getConfidence() {
        return this.detectionConfidence;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageDetector;
}

// Make available globally for console testing
window.MessageDetector = MessageDetector; 