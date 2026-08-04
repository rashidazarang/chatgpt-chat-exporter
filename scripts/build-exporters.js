const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'extraction-engine.js'), 'utf8').trim();
const userscriptUiSource = fs.readFileSync(path.join(repoRoot, 'src', 'userscript-ui.js'), 'utf8').trim();
const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
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

function userscript(name, description) {
    return `${userscriptHeader(name, version, description)}(() => {
    'use strict';

${indent(engineSource, 4)}

${indent(userscriptUiSource, 4)}

    globalThis.ChatExporterUi.install({ engine: globalThis.ChatExporterEngine });
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
        'ChatGPT Chat Exporter - Markdown',
        'Export ChatGPT conversations to Markdown or PDF from the native conversation menus'
    )],
    ['chatgpt-pdf-exporter.user.js', userscript(
        'ChatGPT Chat Exporter - PDF',
        'Export ChatGPT conversations to Markdown or PDF from the native conversation menus'
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
