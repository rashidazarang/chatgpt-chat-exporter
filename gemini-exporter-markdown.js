(() => {
    'use strict';

    // Configuration object for easy maintenance
    const CONFIG = {
        selectors: {
            messages: [
                '[data-test-id="conversation-turn"]',
                '[class*="conversation-turn"]',
                'model-response',
                '[role="presentation"] > div',
                '.conversation-container > div',
                '[class*="message"]',
                'div[class*="turn"]:not([class*="turn"] [class*="turn"])'
            ],
            title: [
                'h1:not([class*="hidden"])',
                '[class*="conversation-title"]',
                '[data-testid*="conversation-title"]',
                '[aria-label*="conversation"]'
            ],
            uiElements: 'button, svg, [class*="copy"], [class*="edit"], [class*="regenerate"], [class*="more"], [aria-label*="copy"]',
            codeBlocks: 'pre',
            media: 'img, canvas'
        },
        patterns: {
            geminiIndicators: /^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course|absolutely)/i,
            userIndicators: /^(can you|please help|how do i|i need|i want|help me|could you|explain|what is)/i,
            genericTitles: /^(gemini|new chat|untitled|chat|bard)$/i
        },
        limits: {
            minMessageLength: 30,
            maxMessageLength: 100000,
            minWords: 5,
            contentHashLength: 100
        }
    };

    // Utility functions
    const utils = {
        formatDate: (date = new Date()) => date.toISOString().split('T')[0],
        
        cleanMarkdown: (text) => text
            .replace(/\\(?![\\*_`])/g, '\\\\')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&'),
        
        createContentHash: (content) => 
            content.substring(0, CONFIG.limits.contentHashLength)
                   .replace(/\s+/g, ' ')
                   .trim(),
        
        isValidMessageLength: (text) => {
            const { minMessageLength, maxMessageLength, minWords } = CONFIG.limits;
            return text.length >= minMessageLength && 
                   text.length <= maxMessageLength && 
                   text.split(' ').length >= minWords;
        },

        logStep: (message, data) => console.log(`[Gemini Exporter] ${message}`, data || ''),
        
        showError: (message, details) => {
            console.error(`[Gemini Exporter] ${message}`, details);
            alert(`Export failed: ${message}`);
        }
    };

    // Message processing functions
    const messageProcessor = {
        processContent: (element) => {
            const clone = element.cloneNode(true);
            
            // Remove UI elements
            clone.querySelectorAll(CONFIG.selectors.uiElements)
                 .forEach(el => el.remove());
            
            // Process code blocks
            messageProcessor.processCodeBlocks(clone);
            
            // Replace media with placeholders
            clone.querySelectorAll(CONFIG.selectors.media)
                 .forEach(el => el.parentNode.replaceChild(
                     document.createTextNode('[Image or Canvas]'), el
                 ));
            
            return utils.cleanMarkdown(clone.innerText.trim());
        },

        processCodeBlocks: (clone) => {
            clone.querySelectorAll(CONFIG.selectors.codeBlocks).forEach(pre => {
                const code = pre.innerText.trim();
                const langMatch = pre.querySelector('code')?.className?.match(/language-([a-zA-Z0-9]+)/);
                const lang = langMatch ? langMatch[1] : '';
                const codeBlock = document.createTextNode(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
                pre.parentNode.replaceChild(codeBlock, pre);
            });
        },

        identifySender: (messageElement, index, allMessages) => {
            // Try different identification methods in order of reliability
            const methods = [
                () => messageProcessor.checkDataAttributes(messageElement),
                () => messageProcessor.checkAvatars(messageElement),
                () => messageProcessor.analyzeContent(messageElement),
                () => messageProcessor.analyzeStructure(messageElement),
                () => messageProcessor.checkClasses(messageElement),
                () => messageProcessor.contextualAnalysis(messageElement, index, allMessages)
            ];

            for (const method of methods) {
                const result = method();
                if (result) return result;
            }

            // Final fallback
            return index % 2 === 0 ? 'You' : 'Gemini';
        },

        checkDataAttributes: (element) => {
            const role = element.getAttribute('data-message-author-role');
            return role === 'user' ? 'You' : role === 'model' ? 'Gemini' : null;
        },

        checkAvatars: (element) => {
            const avatars = element.querySelectorAll('img');
            for (const avatar of avatars) {
                const attrs = [avatar.alt, avatar.src, avatar.className]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                
                if (attrs.includes('user')) return 'You';
                if (attrs.match(/gemini|assistant|bard/)) return 'Gemini';
            }
            return null;
        },

        analyzeContent: (element) => {
            const textStart = element.textContent.toLowerCase().substring(0, 200);
            if (CONFIG.patterns.geminiIndicators.test(textStart)) return 'Gemini';
            if (CONFIG.patterns.userIndicators.test(textStart)) return 'You';
            return null;
        },

        analyzeStructure: (element) => {
            const hasCodeBlocks = element.querySelectorAll('pre, code').length > 0;
            const hasLongText = element.textContent.length > 200;
            const hasLists = element.querySelectorAll('ul, ol, li').length > 0;
            
            return (hasCodeBlocks && hasLongText && hasLists) ? 'Gemini' : null;
        },

        checkClasses: (element) => {
            const classes = [element.className, element.parentElement?.className]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            
            if (classes.match(/model-response|assistant/)) return 'Gemini';
            if (classes.includes('user')) return 'You';
            return null;
        },

        contextualAnalysis: (element, index, allMessages) => {
            if (index === 0 || !allMessages[index - 1]) return null;
            
            const prevLength = allMessages[index - 1].textContent.length;
            const currentLength = element.textContent.length;
            
            if (prevLength < 100 && currentLength > 300) return 'Gemini';
            if (prevLength > 300 && currentLength < 100) return 'You';
            return null;
        }
    };

    // Message finder with improved error handling
    const messageFinder = {
        find: () => {
            utils.logStep('Searching for messages...');
            
            // Try each selector until we find messages
            for (const selector of CONFIG.selectors.messages) {
                const messages = document.querySelectorAll(selector);
                if (messages.length > 0) {
                    utils.logStep(`Found ${messages.length} messages with selector: ${selector}`);
                    return messageFinder.validateMessages(Array.from(messages));
                }
            }

            // Fallback approach
            return messageFinder.fallbackSearch();
        },

        validateMessages: (messages) => {
            return messages.filter(msg => {
                const text = msg.textContent.trim();
                
                if (!utils.isValidMessageLength(text)) return false;
                if (msg.querySelector('input[type="text"], textarea')) return false;
                if (msg.classList.contains('typing') || msg.classList.contains('loading')) return false;
                
                return true;
            });
        },

        fallbackSearch: () => {
            utils.logStep('Trying fallback search...');
            const container = document.querySelector(
                '[role="main"], main, .conversation, [class*="conversation"], [class*="chat"]'
            );
            
            if (!container) return [];
            
            const messages = container.querySelectorAll(':scope > div, :scope > article');
            utils.logStep(`Fallback found ${messages.length} potential messages`);
            
            return messageFinder.validateMessages(Array.from(messages));
        },

        consolidateMessages: (messages) => {
            const consolidated = [];
            const usedElements = new Set();

            messages.forEach(msg => {
                if (usedElements.has(msg)) return;
                
                const isNested = messages.some(other => 
                    other !== msg && other.contains(msg) && !usedElements.has(other)
                );
                
                if (!isNested) {
                    consolidated.push(msg);
                    usedElements.add(msg);
                }
            });

            return consolidated;
        }
    };

    // Export functionality
    const exporter = {
        extractTitle: () => {
            for (const selector of CONFIG.selectors.title) {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    const title = element.textContent.trim();
                    if (!CONFIG.patterns.genericTitles.test(title)) {
                        return title;
                    }
                }
            }
            return 'Conversation with Gemini';
        },

        processMessages: (messages) => {
            const processed = [];
            const seenContent = new Set();

            messages.forEach((messageElement, index) => {
                try {
                    const content = messageProcessor.processContent(messageElement);
                    
                    if (!content || content.trim().length < CONFIG.limits.minMessageLength) {
                        utils.logStep(`Skipping message ${index}: too short`);
                        return;
                    }

                    const contentHash = utils.createContentHash(content);
                    if (seenContent.has(contentHash)) {
                        utils.logStep(`Skipping message ${index}: duplicate`);
                        return;
                    }
                    seenContent.add(contentHash);

                    const sender = messageProcessor.identifySender(messageElement, index, messages);
                    processed.push({ sender, content, originalIndex: index });
                    
                } catch (error) {
                    utils.logStep(`Error processing message ${index}:`, error.message);
                }
            });

            return exporter.fixSenderSequence(processed);
        },

        fixSenderSequence: (messages) => {
            for (let i = 1; i < messages.length; i++) {
                const current = messages[i];
                const previous = messages[i - 1];
                
                if (current.sender === previous.sender) {
                    const currentLength = current.content.length;
                    const previousLength = previous.content.length;
                    
                    if (currentLength > previousLength * 2 && currentLength > 500) {
                        current.sender = 'Gemini';
                    } else if (previousLength > currentLength * 2 && previousLength > 500) {
                        previous.sender = 'Gemini';
                        current.sender = 'You';
                    } else {
                        current.sender = current.sender === 'You' ? 'Gemini' : 'You';
                    }
                    
                    utils.logStep(`Fixed consecutive messages at positions ${i-1} and ${i}`);
                }
            }
            return messages;
        },

        generateMarkdown: (messages) => {
            const title = exporter.extractTitle();
            const date = utils.formatDate();
            const url = window.location.href;

            const lines = [
                `# ${title}\n`,
                `**Date:** ${date}`,
                `**Source:** [gemini.google.com](${url})\n`,
                `---\n`
            ];

            messages.forEach(({ sender, content }) => {
                lines.push(`### **${sender}**\n`, content, '\n---\n');
            });

            return lines.join('\n');
        },

        downloadFile: (content, filename) => {
            try {
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                return true;
            } catch (error) {
                utils.showError('Failed to download file', error);
                return false;
            }
        }
    };

    // Main execution with comprehensive error handling
    try {
        utils.logStep('Starting Gemini conversation export...');
        
        const rawMessages = messageFinder.find();
        if (rawMessages.length === 0) {
            utils.showError('No messages found. The page structure may have changed.');
            return;
        }

        const consolidatedMessages = messageFinder.consolidateMessages(rawMessages);
        utils.logStep(`Consolidated ${rawMessages.length} raw messages into ${consolidatedMessages.length} valid messages`);

        const processedMessages = exporter.processMessages(consolidatedMessages);
        if (processedMessages.length === 0) {
            utils.showError('No valid messages could be processed.');
            return;
        }

        const markdown = exporter.generateMarkdown(processedMessages);
        const filename = `Gemini_Conversation_${utils.formatDate()}.md`;
        
        if (exporter.downloadFile(markdown, filename)) {
            utils.logStep(`Export completed successfully: ${processedMessages.length} messages exported`);
            console.log(`File downloaded: ${filename}`);
        }

    } catch (error) {
        utils.showError('Unexpected error during export', error);
        console.error('[Gemini Exporter] Full error details:', error);
    }
})();
