const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'extraction-engine.js'), 'utf8').trim();
const checkOnly = process.argv.includes('--check');

const GENERATED_NOTICE = `// Generated from src/extraction-engine.js by scripts/build-exporters.js.
// Edit the source engine or this build script, then run npm run build.

`;

function runner(provider, format) {
    return `${GENERATED_NOTICE}(() => {
    'use strict';

${indent(engineSource, 4)}

    globalThis.ChatExporterEngine.exportConversation({
        provider: '${provider}',
        format: '${format}'
    });
})();
`;
}

function userscriptHeader(name, version, description) {
    return `// ==UserScript==
// @name         ${name}
// @namespace    https://github.com/rashidazarang/chatgpt-chat-exporter
// @version      ${version}
// @description  ${description}
// @author       rashidazarang
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://chatgpt.com/c/*
// @match        https://chat.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

`;
}

function userscript(provider, format, buttonId, buttonText, right, color, hoverColor, name, description) {
    return `${userscriptHeader(name, '0.7.1', description)}(() => {
    'use strict';

${indent(engineSource, 4)}

    function runExport() {
        globalThis.ChatExporterEngine.exportConversation({
            provider: '${provider}',
            format: '${format}'
        });
    }

    function addExportButton() {
        if (document.querySelector('#${buttonId}')) return;

        const button = document.createElement('button');
        button.id = '${buttonId}';
        button.textContent = '${buttonText}';
        button.style.cssText = [
            'position: fixed',
            'bottom: 20px',
            'right: ${right}',
            'padding: 10px 16px',
            'background-color: ${color}',
            'color: white',
            'border: none',
            'border-radius: 5px',
            'cursor: pointer',
            'z-index: 10000',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'font-size: 14px',
            'font-weight: 600',
            'box-shadow: 0 2px 4px rgba(0,0,0,0.2)'
        ].join(';');

        button.addEventListener('click', runExport);
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '${hoverColor}';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '${color}';
        });

        document.body.appendChild(button);
    }

    function installButton() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(addExportButton, 1000), { once: true });
        } else {
            setTimeout(addExportButton, 1000);
        }

        const observer = new MutationObserver(() => {
            if (!document.querySelector('#${buttonId}')) addExportButton();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    installButton();
})();
`;
}

function indent(value, spaces) {
    const prefix = ' '.repeat(spaces);
    return value.split('\n').map(line => line ? `${prefix}${line}` : '').join('\n');
}

const outputs = new Map([
    ['exporter-markdown.js', runner('chatgpt', 'markdown')],
    ['exporter-html.js', runner('chatgpt', 'html')],
    ['exporter-pdf.js', runner('chatgpt', 'pdf')],
    ['gemini-exporter-markdown.js', runner('gemini', 'markdown')],
    ['chatgpt-markdown-exporter.user.js', userscript(
        'chatgpt',
        'markdown',
        'chatgpt-export-markdown-btn',
        'Export Markdown',
        '20px',
        '#10a37f',
        '#0d8f6e',
        'ChatGPT Chat Exporter - Markdown',
        'Export ChatGPT conversations to Markdown format'
    )],
    ['chatgpt-pdf-exporter.user.js', userscript(
        'chatgpt',
        'pdf',
        'chatgpt-export-pdf-btn',
        'Export PDF',
        '170px',
        '#3498db',
        '#2c7fb8',
        'ChatGPT Chat Exporter - PDF',
        'Export ChatGPT conversations to PDF-ready HTML format'
    )]
]);

let failed = false;

for (const [relativePath, content] of outputs) {
    const absolutePath = path.join(repoRoot, relativePath);

    if (checkOnly) {
        const current = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
        if (current !== content) {
            console.error(`${relativePath} is not up to date. Run npm run build.`);
            failed = true;
        }
        continue;
    }

    fs.writeFileSync(absolutePath, content);
    console.log(`Wrote ${relativePath}`);
}

if (failed) {
    process.exitCode = 1;
}
