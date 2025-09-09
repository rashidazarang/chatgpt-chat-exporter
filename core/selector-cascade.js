/**
 * Selector Cascade System - Phase 1.2 Implementation
 * Provides robust fallback strategies for ChatGPT element selection
 */

class SelectorCascade {
    constructor() {
        this.strategies = new Map();
        this.cache = new Map();
        this.performance = new Map();
        this.initializeStrategies();
    }

    /**
     * Initialize predefined selector strategies
     */
    initializeStrategies() {
        // Conversation Container Strategies
        this.addStrategy('conversationContainer', [
            {
                name: 'modern-data-attrs',
                selector: '[data-testid*="conversation"], [data-conversation-id], [data-testid*="chat"]',
                priority: 10,
                description: 'Modern data attributes for conversation'
            },
            {
                name: 'aria-conversation',
                selector: '[role="log"], [role="main"][aria-label*="conversation"], [aria-label*="chat"]',
                priority: 9,
                description: 'ARIA-based conversation detection'
            },
            {
                name: 'semantic-main',
                selector: 'main section, main article, main [class*="conversation"]',
                priority: 8,
                description: 'Semantic HTML conversation container'
            },
            {
                name: 'content-based',
                selector: null, // Special handling
                priority: 5,
                description: 'Content-based conversation detection'
            }
        ]);

        // Message Container Strategies
        this.addStrategy('messageContainers', [
            {
                name: 'modern-message-attrs',
                selector: '[data-testid*="message"], [data-message-id], [data-message-author]',
                priority: 10,
                description: 'Modern message data attributes'
            },
            {
                name: 'aria-messages',
                selector: '[role="article"], [role="group"][aria-label*="message"]',
                priority: 9,
                description: 'ARIA-based message detection'
            },
            {
                name: 'semantic-messages',
                selector: 'main article, main section > div[class]',
                priority: 8,
                description: 'Semantic message containers'
            },
            {
                name: 'chatgpt-groups',
                selector: 'div[class*="group"]',
                priority: 6,
                description: 'ChatGPT group-based messages (legacy)'
            },
            {
                name: 'text-base-fallback',
                selector: '.text-base',
                priority: 4,
                description: 'Generic text base fallback'
            }
        ]);

        // Message Content Strategies
        this.addStrategy('messageContent', [
            {
                name: 'modern-content-attrs',
                selector: '[data-testid*="content"], [data-message-content]',
                priority: 10,
                description: 'Modern content data attributes'
            },
            {
                name: 'structured-content',
                selector: '.markdown, .prose, [class*="markdown"], [class*="prose"]',
                priority: 8,
                description: 'Structured content containers'
            },
            {
                name: 'whitespace-content',
                selector: '.whitespace-pre-wrap, [class*="whitespace"]',
                priority: 7,
                description: 'Whitespace-preserved content'
            },
            {
                name: 'direct-text',
                selector: null, // Special handling for direct text extraction
                priority: 5,
                description: 'Direct text content extraction'
            }
        ]);

        // Sender Identification Strategies
        this.addStrategy('senderIdentification', [
            {
                name: 'data-author',
                selector: '[data-message-author], [data-author], [data-sender]',
                priority: 10,
                description: 'Data attribute sender identification'
            },
            {
                name: 'aria-sender',
                selector: '[aria-label*="user"], [aria-label*="assistant"], [aria-label*="you"]',
                priority: 9,
                description: 'ARIA sender identification'
            },
            {
                name: 'avatar-detection',
                selector: 'img[alt*="avatar"], img[alt*="user"], img[src*="avatar"]',
                priority: 8,
                description: 'Avatar-based sender detection'
            },
            {
                name: 'textual-indicators',
                selector: null, // Special handling
                priority: 6,
                description: 'Textual sender indicators'
            },
            {
                name: 'structural-alternation',
                selector: null, // Special handling
                priority: 4,
                description: 'Structural alternation patterns'
            }
        ]);

        // Code Block Strategies
        this.addStrategy('codeBlocks', [
            {
                name: 'structured-pre',
                selector: 'pre code, pre[class*="language"], code[class*="language"]',
                priority: 10,
                description: 'Structured code blocks with language'
            },
            {
                name: 'generic-pre',
                selector: 'pre, code[class*="block"]',
                priority: 8,
                description: 'Generic pre and code blocks'
            },
            {
                name: 'code-containers',
                selector: '.code, [class*="code-"], [data-code]',
                priority: 7,
                description: 'Code container classes'
            }
        ]);
    }

    /**
     * Add a strategy to the cascade
     */
    addStrategy(type, strategies) {
        this.strategies.set(type, strategies.sort((a, b) => b.priority - a.priority));
    }

    /**
     * Execute cascade for a given type
     */
    execute(type, options = {}) {
        const cacheKey = `${type}_${JSON.stringify(options)}`;
        
        // Return cached result if available and not expired
        if (this.cache.has(cacheKey) && !this.isCacheExpired(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const strategies = this.strategies.get(type);
        if (!strategies) {
            console.warn(`No strategies defined for type: ${type}`);
            return null;
        }

        const startTime = performance.now();
        let result = null;

        for (const strategy of strategies) {
            try {
                const strategyResult = this.executeStrategy(strategy, type, options);
                
                if (this.isValidResult(strategyResult, type)) {
                    result = {
                        success: true,
                        strategy: strategy.name,
                        priority: strategy.priority,
                        description: strategy.description,
                        data: strategyResult,
                        executionTime: performance.now() - startTime
                    };
                    break;
                }
            } catch (error) {
                console.warn(`Strategy ${strategy.name} failed:`, error);
                continue;
            }
        }

        if (!result) {
            result = {
                success: false,
                error: `All strategies failed for type: ${type}`,
                executionTime: performance.now() - startTime
            };
        }

        // Cache the result
        this.cache.set(cacheKey, {
            ...result,
            timestamp: Date.now(),
            ttl: options.cacheTtl || 30000 // 30 seconds default
        });

        // Track performance
        this.trackPerformance(type, result);

        return result;
    }

    /**
     * Execute a single strategy
     */
    executeStrategy(strategy, type, options) {
        // Handle special strategies that don't use simple selectors
        if (!strategy.selector) {
            return this.executeSpecialStrategy(strategy, type, options);
        }

        // Standard selector-based strategy
        const elements = document.querySelectorAll(strategy.selector);
        
        if (elements.length === 0) {
            return null;
        }

        // Apply type-specific processing
        switch (type) {
            case 'conversationContainer':
                return this.processConversationContainer(elements);
            case 'messageContainers':
                return this.processMessageContainers(elements, options);
            case 'messageContent':
                return this.processMessageContent(elements, options);
            case 'senderIdentification':
                return this.processSenderIdentification(elements, options);
            case 'codeBlocks':
                return this.processCodeBlocks(elements);
            default:
                return Array.from(elements);
        }
    }

    /**
     * Execute special strategies that require custom logic
     */
    executeSpecialStrategy(strategy, type, options) {
        switch (strategy.name) {
            case 'content-based':
                return this.contentBasedConversationDetection();
            case 'direct-text':
                return this.directTextExtraction(options.parentElement);
            case 'textual-indicators':
                return this.textualSenderDetection();
            case 'structural-alternation':
                return this.structuralSenderDetection(options.messageElements);
            default:
                return null;
        }
    }

    /**
     * Process conversation container results
     */
    processConversationContainer(elements) {
        // Find the most likely conversation container
        let bestContainer = null;
        let bestScore = 0;

        for (const element of elements) {
            const score = this.scoreConversationContainer(element);
            if (score > bestScore) {
                bestScore = score;
                bestContainer = element;
            }
        }

        return bestContainer ? {
            element: bestContainer,
            score: bestScore,
            childCount: bestContainer.children.length
        } : null;
    }

    /**
     * Process message container results
     */
    processMessageContainers(elements, options) {
        const messages = Array.from(elements).filter(el => this.isLikelyMessage(el));
        
        return {
            elements: messages,
            count: messages.length,
            validity: this.validateMessageSequence(messages)
        };
    }

    /**
     * Process message content results
     */
    processMessageContent(elements, options) {
        if (!options.parentMessage) {
            return Array.from(elements);
        }

        // Find content within the specific parent message
        const parentContent = options.parentMessage.querySelectorAll(elements[0].tagName);
        return Array.from(parentContent);
    }

    /**
     * Process sender identification results
     */
    processSenderIdentification(elements, options) {
        const senders = [];
        
        for (const element of elements) {
            const senderInfo = this.extractSenderInfo(element);
            if (senderInfo) {
                senders.push(senderInfo);
            }
        }

        return senders;
    }

    /**
     * Process code block results
     */
    processCodeBlocks(elements) {
        return Array.from(elements).map(block => ({
            element: block,
            language: this.extractCodeLanguage(block),
            content: block.textContent.trim(),
            hasLanguageClass: !!block.querySelector('[class*="language-"]')
        }));
    }

    /**
     * Content-based conversation detection
     */
    contentBasedConversationDetection() {
        const candidates = document.querySelectorAll('div, section, main, article');
        
        for (const candidate of candidates) {
            if (this.hasConversationCharacteristics(candidate)) {
                return {
                    element: candidate,
                    score: this.scoreConversationContainer(candidate),
                    detectionMethod: 'content-analysis'
                };
            }
        }

        return null;
    }

    /**
     * Direct text extraction from parent element
     */
    directTextExtraction(parentElement) {
        if (!parentElement) return null;

        // Extract all text content, preserving structure
        const textNodes = this.getTextNodes(parentElement);
        return {
            fullText: parentElement.textContent.trim(),
            textNodes: textNodes,
            hasFormatting: parentElement.children.length > 0
        };
    }

    /**
     * Textual sender detection
     */
    textualSenderDetection() {
        const textNodes = this.getTextNodes(document.body);
        const senderIndicators = [];

        for (const node of textNodes) {
            const text = node.textContent.trim();
            const senderMatch = text.match(/^(You|ChatGPT|Assistant|System|User)[:.]?\s*$/i);
            
            if (senderMatch) {
                senderIndicators.push({
                    text: senderMatch[1],
                    element: node.parentElement,
                    confidence: this.calculateTextualSenderConfidence(text, node.parentElement)
                });
            }
        }

        return senderIndicators;
    }

    /**
     * Structural sender detection based on alternating patterns
     */
    structuralSenderDetection(messageElements) {
        if (!messageElements || messageElements.length < 2) return null;

        const patterns = {
            classAlternation: this.detectClassAlternation(messageElements),
            positionAlternation: this.detectPositionAlternation(messageElements),
            styleAlternation: this.detectStyleAlternation(messageElements)
        };

        return patterns;
    }

    // Helper methods for scoring and validation
    scoreConversationContainer(element) {
        let score = 0;
        
        // Data attributes increase score
        if (Object.keys(element.dataset).length > 0) score += 3;
        
        // ARIA attributes increase score
        if (element.getAttribute('role') || element.getAttribute('aria-label')) score += 2;
        
        // Semantic tags increase score
        if (['main', 'section', 'article'].includes(element.tagName.toLowerCase())) score += 2;
        
        // Content characteristics
        if (this.hasConversationCharacteristics(element)) score += 3;
        
        // Child count (conversations typically have multiple children)
        if (element.children.length > 1 && element.children.length < 1000) score += 1;

        return score;
    }

    isLikelyMessage(element) {
        const text = element.textContent.trim();
        return text.length > 10 && text.length < 100000; // Reasonable message length
    }

    hasConversationCharacteristics(element) {
        const text = element.textContent.toLowerCase();
        const keywords = ['chatgpt', 'assistant', 'you:', 'user:', 'message', 'conversation'];
        const keywordCount = keywords.filter(keyword => text.includes(keyword)).length;
        
        return keywordCount >= 2 || text.includes('chatgpt');
    }

    validateMessageSequence(messages) {
        if (messages.length < 2) return { valid: false, reason: 'Insufficient messages' };
        
        // Check for reasonable message distribution
        const avgLength = messages.reduce((sum, msg) => sum + msg.textContent.length, 0) / messages.length;
        if (avgLength < 10) return { valid: false, reason: 'Messages too short' };
        if (avgLength > 50000) return { valid: false, reason: 'Messages too long' };
        
        return { valid: true, avgLength, count: messages.length };
    }

    extractSenderInfo(element) {
        // Extract sender information from various attributes and patterns
        const dataAttrs = Object.keys(element.dataset)
            .filter(key => key.includes('author') || key.includes('sender'))
            .map(key => ({ key, value: element.dataset[key] }));

        if (dataAttrs.length > 0) {
            return {
                type: 'data-attribute',
                sender: dataAttrs[0].value,
                confidence: 0.9
            };
        }

        // Check for textual indicators
        const text = element.textContent.trim();
        const senderMatch = text.match(/^(You|ChatGPT|Assistant|System)[:.]?\s*/i);
        
        if (senderMatch) {
            return {
                type: 'textual',
                sender: senderMatch[1],
                confidence: 0.7
            };
        }

        return null;
    }

    extractCodeLanguage(codeElement) {
        // Check for language class
        const langClass = codeElement.querySelector('[class*="language-"]');
        if (langClass) {
            const langMatch = langClass.className.match(/language-([a-zA-Z0-9]+)/);
            return langMatch ? langMatch[1] : null;
        }

        // Check for data attributes
        const dataLang = codeElement.dataset.language || codeElement.dataset.lang;
        if (dataLang) return dataLang;

        return null;
    }

    // Cache and performance management
    isCacheExpired(cacheKey) {
        const cached = this.cache.get(cacheKey);
        return !cached || (Date.now() - cached.timestamp) > cached.ttl;
    }

    trackPerformance(type, result) {
        if (!this.performance.has(type)) {
            this.performance.set(type, {
                executions: 0,
                totalTime: 0,
                successRate: 0,
                avgTime: 0
            });
        }

        const perf = this.performance.get(type);
        perf.executions++;
        perf.totalTime += result.executionTime;
        perf.avgTime = perf.totalTime / perf.executions;
        
        if (result.success) {
            perf.successRate = ((perf.successRate * (perf.executions - 1)) + 1) / perf.executions;
        } else {
            perf.successRate = (perf.successRate * (perf.executions - 1)) / perf.executions;
        }
    }

    getTextNodes(element) {
        const walker = document.createTreeWalker(
            element,
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

    calculateTextualSenderConfidence(text, element) {
        let confidence = 0.7; // Base confidence for textual detection
        
        // Exact matches increase confidence
        if (/^(You|ChatGPT)[:.]?\s*$/.test(text)) confidence += 0.2;
        
        // Position in parent affects confidence
        if (element.parentElement && element === element.parentElement.firstElementChild) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    // Pattern detection methods
    detectClassAlternation(elements) { /* Implementation */ return null; }
    detectPositionAlternation(elements) { /* Implementation */ return null; }
    detectStyleAlternation(elements) { /* Implementation */ return null; }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const stats = {};
        for (const [type, perf] of this.performance) {
            stats[type] = { ...perf };
        }
        return stats;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Reset performance tracking
     */
    resetPerformance() {
        this.performance.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectorCascade;
}

// Make available globally for console testing
window.SelectorCascade = SelectorCascade; 