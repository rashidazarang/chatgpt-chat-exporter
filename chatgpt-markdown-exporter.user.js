// ==UserScript==
// @name         ChatGPT Chat Exporter - Markdown
// @namespace    https://github.com/rashidazarang/chatgpt-chat-exporter
// @version      1.0.0
// @description  Export your ChatGPT conversations as clean Markdown files
// @author       Rashid Azarang
// @match        https://chat.openai.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/rashidazarang/chatgpt-chat-exporter
// @supportURL   https://github.com/rashidazarang/chatgpt-chat-exporter/issues
// ==/UserScript==

(function() {
    'use strict';

    // Add a button to the ChatGPT interface
    function addExportButton() {
        // Check if our button already exists
        if (document.getElementById('export-markdown-button')) return;

        // Find a suitable location to add the button
        const targetElement = document.querySelector('nav');
        if (!targetElement) return;

        // Create the button
        const button = document.createElement('button');
        button.id = 'export-markdown-button';
        button.innerHTML = 'Export as Markdown';
        button.style.cssText = `
            margin: 10px;
            padding: 10px;
            border-radius: 5px;
            background-color: #10a37f;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            width: calc(100% - 20px);
        `;

        // Add click event listener
        button.addEventListener('click', exportMarkdown);

        // Add button to the page
        targetElement.appendChild(button);
    }

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

    function exportMarkdown() {
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
    }

    // Add the export button when the DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addExportButton);
    } else {
        addExportButton();
    }

    // Check periodically if the button needs to be added (for SPAs like ChatGPT)
    setInterval(addExportButton, 3000);
})(); 