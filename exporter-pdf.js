(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function sanitize(text) {
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function extractFormattedContent() {
        const messages = document.querySelectorAll('.text-base');
        let html = '';

        messages.forEach((msg, index) => {
            const sender = index % 2 === 0 ? 'You' : 'ChatGPT';
            const contentBlock = msg.querySelector('.whitespace-pre-wrap, .markdown, .prose');
            if (!contentBlock) return;

            const clone = contentBlock.cloneNode(true);

            clone.querySelectorAll('pre').forEach(pre => {
                const code = sanitize(pre.innerText.trim());
                pre.replaceWith(`<pre><code>${code}</code></pre>`);
            });

            clone.querySelectorAll('img, canvas').forEach(el => {
                el.replaceWith('[Image or Canvas]');
            });

            const cleanText = sanitize(clone.innerText.trim()).replace(/\n/g, '<br>');

            html += `
                <div class="message">
                    <div class="sender">${sender}</div>
                    <div class="content">${cleanText}</div>
                </div>
            `;
        });

        return html;
    }

    const date = formatDate();
    const source = window.location.href;
    const conversationHTML = extractFormattedContent();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ChatGPT Conversation - ${date}</title>
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
    <h1>ChatGPT Conversation</h1>
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
