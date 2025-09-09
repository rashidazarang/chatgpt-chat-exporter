(() => {
    // Direct PDF generation without external libraries
    // This creates a data URL that triggers browser's print-to-PDF dialog
    
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function cleanText(text) {
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .trim();
    }

    function findMessages() {
        const selectors = [
            'div[data-message-author-role]',
            'article[data-testid*="conversation-turn"]',
            'div[data-testid="conversation-turn"]',
            '.group\\/conversation-turn',
            'div[class*="group"]:not([class*="group"] [class*="group"])'
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`PDF: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`PDF: Fallback: found ${messages.length} potential messages`);
            }
        }

        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();
            return text.length >= 30 && text.length <= 100000;
        });

        const consolidatedMessages = [];
        const usedElements = new Set();

        validMessages.forEach(msg => {
            if (usedElements.has(msg)) return;
            
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

    function identifySender(messageElement, index) {
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            if (alt.includes('user')) return 'You';
            if (alt.includes('chatgpt') || alt.includes('assistant')) return 'ChatGPT';
        }

        return index % 2 === 0 ? 'You' : 'ChatGPT';
    }

    function processMessageContent(element) {
        const clone = element.cloneNode(true);
        
        // Remove UI elements
        clone.querySelectorAll('button, svg, [class*="copy"], [class*="edit"]').forEach(el => el.remove());
        
        // Process code blocks
        clone.querySelectorAll('pre').forEach(pre => {
            const code = pre.innerText.trim();
            const codeBlock = document.createElement('div');
            codeBlock.className = 'code-block';
            codeBlock.textContent = code;
            pre.parentNode.replaceChild(codeBlock, pre);
        });
        
        // Replace images
        clone.querySelectorAll('img, canvas').forEach(el => {
            const placeholder = document.createTextNode('[Image]');
            el.parentNode.replaceChild(placeholder, el);
        });
        
        return clone.innerText.trim();
    }

    function extractTitle() {
        const titleSelectors = [
            'h1:not([class*="hidden"])',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const title = element.textContent.trim();
                if (!['chatgpt', 'new chat', 'untitled'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }
        
        const docTitle = document.title;
        if (docTitle && !docTitle.toLowerCase().includes('chatgpt')) {
            return docTitle;
        }
        
        return 'ChatGPT Conversation';
    }

    // Main export logic
    const messages = findMessages();
    
    if (messages.length === 0) {
        alert('No messages found. The page structure may have changed.');
        return;
    }

    console.log(`PDF: Processing ${messages.length} messages...`);

    const title = extractTitle();
    const date = formatDate();
    const url = window.location.href;

    // Create HTML content optimized for PDF printing
    let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${cleanText(title)}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .message { page-break-inside: avoid; }
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        
        .metadata {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .message {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            page-break-inside: avoid;
        }
        
        .message.user {
            background: #e3f2fd;
            margin-left: 40px;
        }
        
        .message.assistant {
            background: #f3f4f6;
            margin-right: 40px;
        }
        
        .sender {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .content {
            color: #333;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .code-block {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: "Courier New", monospace;
            font-size: 14px;
            margin: 10px 0;
        }
        
        .instructions {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .instructions h3 {
            margin-top: 0;
            color: #856404;
        }
        
        @media screen {
            .instructions {
                position: sticky;
                top: 20px;
                z-index: 1000;
            }
        }
    </style>
</head>
<body>
    <div class="instructions no-print">
        <h3>📄 Convert to PDF</h3>
        <ol>
            <li>Press <strong>Ctrl+P</strong> (Windows/Linux) or <strong>Cmd+P</strong> (Mac)</li>
            <li>Set "Destination" to <strong>"Save as PDF"</strong></li>
            <li>Choose your preferred settings (recommend "Letter" or "A4" size)</li>
            <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><em>This instruction box will not appear in the PDF.</em></p>
    </div>

    <h1>${cleanText(title)}</h1>
    
    <div class="metadata">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Source:</strong> <a href="${url}">${url}</a></p>
        <p><strong>Messages:</strong> ${messages.length}</p>
    </div>
    
    <div class="conversation">`;

    // Process messages
    const seenContent = new Set();
    let processedCount = 0;

    messages.forEach((messageElement, index) => {
        const sender = identifySender(messageElement, index);
        const content = processMessageContent(messageElement);
        
        if (!content || content.length < 10) return;
        
        const contentHash = content.substring(0, 100).replace(/\s+/g, ' ');
        if (seenContent.has(contentHash)) return;
        seenContent.add(contentHash);
        
        const senderClass = sender.toLowerCase() === 'you' ? 'user' : 'assistant';
        
        htmlContent += `
        <div class="message ${senderClass}">
            <div class="sender">${cleanText(sender)}</div>
            <div class="content">${cleanText(content).replace(/\[CODE\]([\s\S]*?)\[\/CODE\]/g, '<pre class="code-block">$1</pre>')}</div>
        </div>`;
        
        processedCount++;
    });

    htmlContent += `
    </div>
</body>
</html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url2 = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url2;
    const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    a.download = safeTitle ? `${safeTitle} (${date}) - PrintToPDF.html` : `ChatGPT_Conversation_${date}_PrintToPDF.html`;
    
    // Auto-download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url2);

    console.log(`PDF: Export completed - ${processedCount} messages processed`);
    console.log('PDF: The HTML file has been downloaded. Open it and press Ctrl+P (Cmd+P on Mac) to save as PDF.');
    
    // Show instructions
    alert(`✅ Export Complete!\n\n${processedCount} messages exported.\n\nTo create PDF:\n1. Open the downloaded HTML file\n2. Press Ctrl+P (Cmd+P on Mac)\n3. Choose "Save as PDF"\n4. Click Save\n\nThe yellow instruction box will not appear in the PDF.`);
})();