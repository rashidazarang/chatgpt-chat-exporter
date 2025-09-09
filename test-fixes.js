/**
 * Test Script for ChatGPT Chat Exporter Fixes
 * This script tests the fixes for reported issues
 */

(() => {
    console.log('=== ChatGPT Chat Exporter Test Suite ===');
    
    // Test 1: Check for improved selectors (Issue #6)
    console.log('\nTest 1: Checking message selectors...');
    const selectors = [
        'div[data-message-author-role]',
        'article[data-testid*="conversation-turn"]',
        'div[data-testid="conversation-turn"]',
        '.group\\/conversation-turn',
        'div[class*="group"]:not([class*="group"] [class*="group"])'
    ];
    
    let foundMessages = false;
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`✓ Found ${elements.length} messages with selector: ${selector}`);
                foundMessages = true;
                break;
            }
        } catch (e) {
            console.log(`✗ Invalid selector: ${selector}`);
        }
    }
    
    if (!foundMessages) {
        console.log('✗ No messages found with any selector');
    }
    
    // Test 2: Check file naming (Issue #12)
    console.log('\nTest 2: Testing file naming...');
    const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    const date = new Date().toISOString().split('T')[0];
    const fileName = safeTitle ? `${safeTitle} (${date}).md` : `ChatGPT_Conversation_${date}.md`;
    console.log(`✓ Generated filename: ${fileName}`);
    
    // Test 3: Check for Deep Research content (Issue #7)
    console.log('\nTest 3: Checking for Deep Research content...');
    const deepResearchIndicators = [
        '[class*="deep-research"]',
        '[class*="research-result"]',
        '[class*="rounded-box"]',
        'div[class*="border"][class*="rounded"]'
    ];
    
    let hasDeepResearch = false;
    for (const indicator of deepResearchIndicators) {
        const elements = document.querySelectorAll(indicator);
        if (elements.length > 0) {
            console.log(`✓ Found Deep Research content with: ${indicator}`);
            hasDeepResearch = true;
            
            // Check if content is properly extracted
            elements.forEach((el, idx) => {
                const text = el.textContent.trim();
                if (text.length > 0) {
                    console.log(`  - Element ${idx + 1}: ${text.substring(0, 50)}...`);
                }
            });
            break;
        }
    }
    
    if (!hasDeepResearch) {
        console.log('ℹ No Deep Research content detected (this is normal for regular chats)');
    }
    
    // Test 4: Check sender detection
    console.log('\nTest 4: Testing sender detection...');
    const testMessage = document.querySelector('[data-message-author-role], [class*="group"], article');
    if (testMessage) {
        const authorRole = testMessage.getAttribute('data-message-author-role');
        if (authorRole) {
            console.log(`✓ Found author role attribute: ${authorRole}`);
        } else {
            console.log('ℹ No author role attribute, will use fallback detection');
        }
    }
    
    // Test 5: Check for duplicate content
    console.log('\nTest 5: Checking for duplicate content...');
    const allMessages = document.querySelectorAll('[class*="group"], article[data-testid*="conversation"]');
    const contentHashes = new Set();
    let duplicates = 0;
    
    allMessages.forEach((msg, idx) => {
        const hash = msg.textContent.trim().substring(0, 100).replace(/\s+/g, ' ');
        if (contentHashes.has(hash) && hash.length > 10) {
            duplicates++;
            console.log(`⚠ Potential duplicate at message ${idx + 1}`);
        }
        contentHashes.add(hash);
    });
    
    if (duplicates === 0) {
        console.log('✓ No duplicate messages detected');
    } else {
        console.log(`⚠ Found ${duplicates} potential duplicate messages`);
    }
    
    // Test 6: URL compatibility check (Issue #13)
    console.log('\nTest 6: URL compatibility...');
    const currentURL = window.location.href;
    const supportedPatterns = [
        'https://chatgpt.com/c/',
        'https://chatgpt.com/g/',
        'https://chat.openai.com/'
    ];
    
    const isSupported = supportedPatterns.some(pattern => currentURL.includes(pattern));
    if (isSupported) {
        console.log(`✓ Current URL is supported: ${currentURL}`);
    } else {
        console.log(`⚠ Current URL may not be fully supported: ${currentURL}`);
    }
    
    console.log('\n=== Test Suite Complete ===');
    console.log('Run the actual exporter script to verify the fixes work correctly.');
    
    // Return a summary object for clarity
    return {
        status: 'Tests completed',
        message: 'Check console output above for detailed results',
        nextStep: 'Run exporter-markdown.js or exporter-pdf.js to export the conversation'
    };
})();