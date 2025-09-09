(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function escapeMarkdown(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/`/g, '\\`')
            .replace(/\n{3,}/g, '\n\n');
    }

    function processMessageContent(element) {
        const clone = element.cloneNode(true);

        // Replace <pre><code> blocks
        clone.querySelectorAll('pre').forEach(pre => {
            const code = pre.innerText.trim();
            const langMatch = pre.querySelector('code')?.className?.match(/language-([a-zA-Z0-9]+)/);
            const lang = langMatch ? langMatch[1] : '';
            pre.replaceWith(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`);
        });

        // Replace images and canvas with placeholders
        clone.querySelectorAll('img, canvas').forEach(el => {
            el.replaceWith('[Image or Canvas]');
        });

        // Convert remaining HTML to plain markdown-style text
        return escapeMarkdown(clone.innerText.trim());
    }

    const messages = document.querySelectorAll('div[class*="group"]');
    const lines = [];

    const title = 'Conversation with ChatGPT';
    const date = formatDate();
    const url = window.location.href;

    lines.push(`# ${title}\n`);
    lines.push(`**Date:** ${date}`);
    lines.push(`**Source:** [chat.openai.com](${url})\n`);
    lines.push(`---\n`);

    messages.forEach(group => {
        const isUser = !!group.querySelector('img');
        const sender = isUser ? 'You' : 'ChatGPT';
        const block = group.querySelector('.markdown, .prose, .whitespace-pre-wrap');

        if (block) {
            const content = processMessageContent(block);
            if (content) {
                lines.push(`### **${sender}**\n`);
                lines.push(content);
                lines.push('\n---\n');
            }
        }
    });

    const markdown = lines.join('\n').trim();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.download = `ChatGPT_Conversation_${date}.md`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
})(); 