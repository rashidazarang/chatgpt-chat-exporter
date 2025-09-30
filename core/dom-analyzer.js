/**
 * ChatGPT DOM Analyzer - Phase 1.1 Implementation
 * Analyzes and validates DOM selectors for robust chat export
 */

class ChatGPTDOMAnalyzer {
    constructor() {
        this.selectorStrategies = {
            // Modern data-attribute based selectors (highest priority)
            dataAttributes: [
                '[data-testid*="conversation"]',
                '[data-testid*="message"]',
                '[data-message-author-role]',
                '[data-message-id]',
                '[data-conversation-id]'
            ],
            
            // ARIA and accessibility selectors (high priority)
            ariaSelectors: [
                '[role="article"]',
                '[role="group"][aria-label*="message"]',
                '[role="log"]',
                '[aria-label*="conversation"]',
                '[aria-label*="chat"]'
            ],
            
            // Semantic HTML selectors (medium priority)
            semanticSelectors: [
                'main article',
                'main section',
                '.conversation',
                '.chat',
                '.message'
            ],
            
            // Content-based selectors (low priority, last resort)
            contentSelectors: [
                'div[class*="group"]',
                '.text-base',
                '.whitespace-pre-wrap',
                '.markdown',
                '.prose'
            ]
        };
        
        this.validationResults = {};
        this.reliabilityScores = {};
    }

    /**
     * Analyze the current page DOM structure
     */
    analyzePage() {
        const analysis = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            pageStructure: this.getPageStructure(),
            conversationContainer: this.findConversationContainer(),
            messageContainers: this.findMessageContainers(),
            senderIdentification: this.analyzeSenderPatterns(),
            contentStructure: this.analyzeContentStructure(),
            metadataElements: this.findMetadataElements()
        };

        console.log('ChatGPT DOM Analysis:', analysis);
        return analysis;
    }

    /**
     * Get high-level page structure information
     */
    getPageStructure() {
        return {
            title: document.title,
            bodyClasses: Array.from(document.body.classList),
            mainElement: !!document.querySelector('main'),
            navElement: !!document.querySelector('nav'),
            asideElement: !!document.querySelector('aside'),
            reactRoot: !!document.querySelector('#__next, [data-reactroot]'),
            totalElements: document.querySelectorAll('*').length,
            scriptsCount: document.querySelectorAll('script').length
        };
    }

    /**
     * Find the main conversation container using multiple strategies
     */
    findConversationContainer() {
        const strategies = [
            // Strategy 1: Data attributes
            () => document.querySelector('[data-testid*="conversation"], [data-testid*="chat"]'),
            
            // Strategy 2: ARIA roles
            () => document.querySelector('[role="log"], [role="main"][aria-label*="conversation"]'),
            
            // Strategy 3: Semantic structure
            () => document.querySelector('main section, main article, main div[class*="conversation"]'),
            
            // Strategy 4: Content-based detection
            () => {
                const candidates = document.querySelectorAll('div, section, main');
                for (const candidate of candidates) {
                    if (this.hasConversationContent(candidate)) {
                        return candidate;
                    }
                }
                return null;
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            const result = strategies[i]();
            if (result) {
                return {
                    element: result,
                    strategy: i + 1,
                    selector: this.generateSelector(result),
                    confidence: this.calculateConfidence(result, 'conversation')
                };
            }
        }

        return null;
    }

    /**
     * Find individual message containers
     */
    findMessageContainers() {
        const strategies = [
            // Strategy 1: Data attributes for messages
            '[data-testid*="message"], [data-message-id], [data-message-author]',
            
            // Strategy 2: ARIA article roles
            '[role="article"], [role="group"][aria-label*="message"]',
            
            // Strategy 3: Common message patterns
            'main article, main > div > div[class], .message, .chat-message',
            
            // Strategy 4: Legacy selectors (current codebase)
            'div[class*="group"], .text-base',
            
            // Strategy 5: Content-based detection
            null // Handled separately
        ];

        const results = [];
        
        for (const selector of strategies) {
            if (!selector) continue;
            
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                results.push({
                    selector,
                    count: elements.length,
                    elements: Array.from(elements).slice(0, 5), // Sample first 5
                    confidence: this.calculateSelectorConfidence(selector, elements)
                });
            }
        }

        // Content-based detection
        const contentBasedMessages = this.findMessagesByContent();
        if (contentBasedMessages.length > 0) {
            results.push({
                selector: 'content-based',
                count: contentBasedMessages.length,
                elements: contentBasedMessages.slice(0, 5),
                confidence: 0.6 // Lower confidence for content-based
            });
        }

        return results;
    }

    /**
     * Analyze sender identification patterns
     */
    analyzeSenderPatterns() {
        const patterns = {
            avatarImages: this.findAvatarPatterns(),
            textualIndicators: this.findTextualSenderIndicators(),
            structuralPatterns: this.findStructuralSenderPatterns(),
            dataAttributes: this.findSenderDataAttributes()
        };

        return patterns;
    }

    /**
     * Find avatar-based sender identification
     */
    findAvatarPatterns() {
        const avatars = document.querySelectorAll('img[alt*="avatar"], img[alt*="user"], img[src*="avatar"]');
        return {
            count: avatars.length,
            patterns: Array.from(avatars).map(img => ({
                alt: img.alt,
                src: img.src,
                parentSelector: this.generateSelector(img.parentElement),
                className: img.className
            })).slice(0, 3)
        };
    }

    /**
     * Find textual sender indicators
     */
    findTextualSenderIndicators() {
        const indicators = [];
        const textNodes = this.getTextNodes();
        
        for (const node of textNodes) {
            const text = node.textContent.trim();
            if (/^(You|ChatGPT|Assistant|System)[:.]?\s*$/i.test(text)) {
                indicators.push({
                    text,
                    element: node.parentElement,
                    selector: this.generateSelector(node.parentElement)
                });
            }
        }

        return indicators.slice(0, 5);
    }

    /**
     * Find structural sender patterns
     */
    findStructuralSenderPatterns() {
        // Look for alternating patterns in message structure
        const messageContainers = this.findMessageContainers();
        if (messageContainers.length === 0) return null;

        const bestContainer = messageContainers[0];
        const messages = bestContainer.elements;
        
        if (messages.length < 2) return null;

        const patterns = {
            alternatingClasses: this.analyzeAlternatingClasses(messages),
            positionPatterns: this.analyzePositionPatterns(messages),
            stylePatterns: this.analyzeStylePatterns(messages)
        };

        return patterns;
    }

    /**
     * Find sender data attributes
     */
    findSenderDataAttributes() {
        const senderElements = document.querySelectorAll('[data-message-author], [data-author], [data-sender]');
        return Array.from(senderElements).map(el => ({
            attributes: Object.fromEntries(
                Array.from(el.attributes)
                    .filter(attr => attr.name.includes('author') || attr.name.includes('sender'))
                    .map(attr => [attr.name, attr.value])
            ),
            selector: this.generateSelector(el)
        })).slice(0, 5);
    }

    /**
     * Analyze content structure patterns
     */
    analyzeContentStructure() {
        return {
            codeBlocks: this.analyzeCodeBlocks(),
            formatting: this.analyzeFormattingElements(),
            media: this.analyzeMediaElements(),
            links: this.analyzeLinkElements()
        };
    }

    /**
     * Analyze code block patterns
     */
    analyzeCodeBlocks() {
        const codeBlocks = document.querySelectorAll('pre, code, .code, [class*="code"]');
        const patterns = [];

        for (const block of codeBlocks) {
            if (block.textContent.trim().length > 10) { // Meaningful code blocks
                patterns.push({
                    tagName: block.tagName,
                    className: block.className,
                    hasLanguage: !!block.querySelector('code[class*="language-"]'),
                    selector: this.generateSelector(block),
                    preview: block.textContent.trim().substring(0, 50) + '...'
                });
            }
        }

        return patterns.slice(0, 5);
    }

    /**
     * Find metadata elements (title, date, etc.)
     */
    findMetadataElements() {
        return {
            title: this.findConversationTitle(),
            timestamp: this.findTimestampElements(),
            model: this.findModelIndicators(),
            conversation_id: this.findConversationId()
        };
    }

    /**
     * Test selector reliability
     */
    testSelectorReliability(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            const score = this.calculateSelectorConfidence(selector, elements);
            
            this.reliabilityScores[selector] = {
                score,
                elementCount: elements.length,
                timestamp: Date.now(),
                passed: score > 0.7
            };

            return this.reliabilityScores[selector];
        } catch (error) {
            this.reliabilityScores[selector] = {
                score: 0,
                elementCount: 0,
                timestamp: Date.now(),
                passed: false,
                error: error.message
            };
            return this.reliabilityScores[selector];
        }
    }

    /**
     * Calculate confidence score for elements/selectors
     */
    calculateConfidence(element, type) {
        if (!element) return 0;

        let score = 0.5; // Base score

        // Data attributes boost confidence significantly
        if (element.dataset && Object.keys(element.dataset).length > 0) {
            score += 0.3;
        }

        // ARIA attributes boost confidence
        if (element.getAttribute('role') || element.getAttribute('aria-label')) {
            score += 0.2;
        }

        // Semantic HTML boosts confidence
        if (['main', 'section', 'article', 'aside'].includes(element.tagName.toLowerCase())) {
            score += 0.1;
        }

        // Content relevance for conversation type
        if (type === 'conversation' && this.hasConversationContent(element)) {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Calculate selector confidence based on results
     */
    calculateSelectorConfidence(selector, elements) {
        if (!elements || elements.length === 0) return 0;

        let score = 0.5;

        // Data attribute selectors are more reliable
        if (selector.includes('[data-')) score += 0.3;
        if (selector.includes('[role=')) score += 0.2;
        if (selector.includes('[aria-')) score += 0.15;

        // Class-based selectors are less reliable
        if (selector.includes('.') && !selector.includes('[')) score -= 0.2;

        // Very generic selectors are unreliable
        if (['div', 'span', '.text-base'].some(generic => selector.includes(generic))) {
            score -= 0.1;
        }

        // Reasonable element count
        if (elements.length > 0 && elements.length < 1000) {
            score += 0.1;
        }

        return Math.max(0, Math.min(score, 1.0));
    }

    // Helper methods
    hasConversationContent(element) {
        const text = element.textContent.toLowerCase();
        const conversationKeywords = ['chatgpt', 'you:', 'assistant:', 'user:', 'message', 'conversation'];
        return conversationKeywords.some(keyword => text.includes(keyword));
    }

    generateSelector(element) {
        if (!element) return null;
        
        // Prioritize data attributes
        if (element.id) return `#${element.id}`;
        
        const dataAttrs = Object.keys(element.dataset);
        if (dataAttrs.length > 0) {
            return `[data-${dataAttrs[0]}="${element.dataset[dataAttrs[0]]}"]`;
        }

        // Use class names as fallback
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) {
                return `.${classes[0]}`;
            }
        }

        return element.tagName.toLowerCase();
    }

    getTextNodes() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            if (node.textContent.trim().length > 0) {
                textNodes.push(node);
            }
        }

        return textNodes;
    }

    findMessagesByContent() {
        // This would implement content-based message detection
        // as a fallback when other selectors fail
        return [];
    }

    // Additional analysis methods would be implemented here
    analyzeAlternatingClasses(messages) { return null; }
    analyzePositionPatterns(messages) { return null; }
    analyzeStylePatterns(messages) { return null; }
    analyzeFormattingElements() { return null; }
    analyzeMediaElements() { return null; }
    analyzeLinkElements() { return null; }
    findConversationTitle() { return null; }
    findTimestampElements() { return null; }
    findModelIndicators() { return null; }
    findConversationId() { return null; }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatGPTDOMAnalyzer;
}

// Make available globally for console testing
window.ChatGPTDOMAnalyzer = ChatGPTDOMAnalyzer; 