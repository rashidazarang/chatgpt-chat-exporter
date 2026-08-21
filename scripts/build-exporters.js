const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'extraction-engine.js'), 'utf8').trim();
const userscriptUiSource = fs.readFileSync(path.join(repoRoot, 'src', 'userscript-ui.js'), 'utf8').trim();
const progressOverlaySource = fs.readFileSync(path.join(repoRoot, 'src', 'progress-overlay.js'), 'utf8').trim();
const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const GENERATED_NOTICE = `// Generated from src/extraction-engine.js by scripts/build-exporters.js.
// Edit the source engine or this build script, then run npm run build.

`;

function runner(provider, format) {
    return `${GENERATED_NOTICE}(() => {
    'use strict';

    // Set to false to omit ChatGPT's per-answer reasoning/progress updates.
    const INCLUDE_REASONING = true;

${indent(engineSource, 4)}

${indent(progressOverlaySource, 4)}

    // The progress card is an enhancement: if it cannot be created, the export
    // runs exactly as it always has.
    const progress = globalThis.ChatExporterProgress.create(document);

    globalThis.ChatExporterEngine.exportConversationFull({
        provider: '${provider}',
        format: '${format}',
        includeReasoning: INCLUDE_REASONING,
        onProgress: progress.onProgress
    }).catch(error => {
        progress.destroy();
        console.error('[Chat Exporter] Export failed.', error);
    });
})();
`;
}

// Paste-into-the-console health check. Generated from the same engine as the
// exporters so it always reports on the selectors that actually ship.
function doctor() {
    return `${GENERATED_NOTICE}(() => {
    'use strict';

${indent(engineSource, 4)}

    globalThis.ChatExporterEngine.diagnose().then(report => {
        console.log('%c[Chat Exporter] Selector health — ' + report.provider + ' (engine ' + report.version + ')',
            'font-weight:bold');
        console.log('Messages found: ' + report.messagesFound +
            ' · resolved selector: ' + (report.resolvedMessageSelector || 'none') +
            ' · scroll container: ' + report.scrollContainer);
        console.log('Title: "' + report.title.value + '" (via ' + report.title.resolvedBy + ')');
        console.table(report.messageSelectors);
        console.table(report.contentSelectors);
        if (report.api) console.log('Private API:', report.api);
        report.notes.forEach(note => console.log('[Chat Exporter] ' + note));
        if (report.warnings.length) {
            report.warnings.forEach(warning => console.warn('[Chat Exporter] ' + warning));
        } else {
            console.log('%cNo drift detected.', 'color:green');
        }
        globalThis.ChatExporterReport = report;
        console.log('Full report saved to window.ChatExporterReport');
    }).catch(error => console.error('[Chat Exporter] Health check failed.', error));
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

${indent(progressOverlaySource, 4)}

${indent(userscriptUiSource, 4)}

    globalThis.ChatExporterUi.install({
        engine: globalThis.ChatExporterEngine,
        progress: globalThis.ChatExporterProgress
    });
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
    ['selector-doctor.js', doctor()],
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
