// Generated from src/extraction-engine.js by scripts/build-exporters.js.
// Edit the source engine or this build script, then run npm run build.

(() => {
    'use strict';

    (function initChatExporterEngine(root, factory) {
        const engine = factory();

        if (root) {
            root.ChatExporterEngine = engine;
        }

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = engine;
        }
    })(typeof globalThis !== 'undefined' ? globalThis : this, function buildChatExporterEngine() {
        'use strict';

        const ENGINE_VERSION = '0.7.0-live-engine';
        const MARKER_PREFIX = '__CHAT_EXPORTER_BLOCK_';

        const PROVIDERS = {
            chatgpt: {
                id: 'chatgpt',
                assistantName: 'ChatGPT',
                sourceLabel: 'chatgpt.com',
                defaultTitle: 'Conversation with ChatGPT',
                genericTitlePattern: /^(chatgpt|new chat|untitled|chat)$/i,
                messageSelectors: [
                    'div[data-message-author-role]',
                    'article[data-testid*="conversation-turn"]',
                    'div[data-testid="conversation-turn"]',
                    '.group\\/conversation-turn',
                    '[data-testid*="message"], [data-message-id], [data-message-author]'
                ],
                contentSelectors: [
                    '.markdown, .prose, [class*="markdown"], [class*="prose"]',
                    '[data-message-content], [data-testid*="content"]',
                    '.whitespace-pre-wrap, [class*="whitespace"]'
                ],
                titleSelectors: [
                    'h1:not([class*="hidden"])',
                    '[class*="conversation-title"]',
                    '[data-testid*="conversation-title"]'
                ]
            },
            gemini: {
                id: 'gemini',
                assistantName: 'Gemini',
                sourceLabel: 'gemini.google.com',
                defaultTitle: 'Conversation with Gemini',
                genericTitlePattern: /^(gemini|new chat|untitled|chat|bard)$/i,
                messageSelectors: [
                    'user-query, model-response',
                    '[data-test-id="conversation-turn"]',
                    '[data-testid="conversation-turn"]',
                    '[data-message-author-role]',
                    '[class*="conversation-turn"]',
                    '[role="listitem"]'
                ],
                contentSelectors: [
                    'message-content',
                    '.query-text',
                    '.response-container',
                    '.markdown, .prose, [class*="markdown"], [class*="prose"]'
                ],
                titleSelectors: [
                    'h1:not([class*="hidden"])',
                    '[class*="conversation-title"]',
                    '[data-testid*="conversation-title"]',
                    '[aria-label*="conversation"]'
                ]
            }
        };

        function resolveDocument(doc) {
            if (doc) return doc;
            if (typeof document !== 'undefined') return document;
            throw new Error('ChatExporterEngine requires a document.');
        }

        function getWindow(doc) {
            return doc.defaultView || (typeof window !== 'undefined' ? window : null);
        }

        function formatDate(date = new Date()) {
            return date.toISOString().split('T')[0];
        }

        function sanitizeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function normalizeWhitespace(value) {
            return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function getClassName(element) {
            const className = element?.className;
            if (!className) return '';
            if (typeof className === 'string') return className;
            return className.baseVal || '';
        }

        function queryAll(root, selector) {
            if (!root || !selector) return [];

            try {
                return Array.from(root.querySelectorAll(selector));
            } catch (error) {
                console.warn('[Chat Exporter] Selector failed:', selector, error);
                return [];
            }
        }

        function matches(element, selector) {
            if (!element || !selector || typeof element.matches !== 'function') return false;

            try {
                return element.matches(selector);
            } catch (error) {
                return false;
            }
        }

        function getText(element) {
            if (!element) return '';
            const innerText = typeof element.innerText === 'string' ? element.innerText : '';
            return (innerText || element.textContent || '').replace(/\u00a0/g, ' ').trim();
        }

        function collectTextWithBreaks(node) {
            if (!node) return '';

            if (node.nodeType === 3) {
                return node.nodeValue || '';
            }

            if (node.nodeType !== 1) {
                return '';
            }

            const tag = node.tagName.toLowerCase();
            if (tag === 'br') return '\n';
            if (['script', 'style', 'button', 'svg'].includes(tag)) return '';

            const before = ['div', 'p', 'li', 'tr', 'section', 'article'].includes(tag) ? '\n' : '';
            const after = ['div', 'p', 'li', 'tr', 'section', 'article'].includes(tag) ? '\n' : '';
            return before + Array.from(node.childNodes).map(collectTextWithBreaks).join('') + after;
        }

        function getCodeText(element) {
            if (!element) return '';

            if (typeof element.innerText === 'string' && element.innerText.trim()) {
                return element.innerText.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd();
            }

            const clone = element.cloneNode(true);
            queryAll(clone, 'br').forEach(br => br.replaceWith(clone.ownerDocument.createTextNode('\n')));
            return collectTextWithBreaks(clone).replace(/\n{3,}/g, '\n\n').trimEnd();
        }

        function normalizeCodeText(value) {
            return String(value ?? '')
                .replace(/\r\n?/g, '\n')
                .replace(/^\n+/, '')
                .replace(/\n+$/, '');
        }

        function createTextNode(reference, text) {
            return reference.ownerDocument.createTextNode(text);
        }

        function addReplacement(replacements, html) {
            const marker = `${MARKER_PREFIX}${replacements.length}__`;
            replacements.push({ marker, html });
            return marker;
        }

        function restoreReplacements(value, replacements) {
            return replacements.reduce((result, replacement) => result.replaceAll(replacement.marker, replacement.html), value);
        }

        function cleanMarkdown(markdown) {
            return String(markdown ?? '')
                .split(/(```[\s\S]*?```)/g)
                .map(part => part.startsWith('```')
                    ? part
                    : part
                        .replace(/[ \t]+\n/g, '\n')
                        .replace(/\n[ \t]+/g, '\n')
                        .replace(/\n{3,}/g, '\n\n')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&'))
                .join('')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        function escapeMarkdownLinkText(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/([\[\]])/g, '\\$1');
        }

        function escapeMarkdownUrl(value) {
            return String(value ?? '')
                .replace(/\\/g, '%5C')
                .replace(/\)/g, '%29');
        }

        function isUnsafeHref(href) {
            const lower = String(href || '').trim().toLowerCase();
            return !lower ||
                lower.startsWith('javascript:') ||
                lower.startsWith('data:') ||
                lower.startsWith('vbscript:') ||
                lower.startsWith('#');
        }

        function topLevelElements(elements) {
            return elements.filter(element => !elements.some(other => other !== element && other.contains(element)));
        }

        function removeUiElements(clone) {
            const uiSelector = [
                'button',
                'svg',
                'style',
                'script',
                'textarea',
                'input',
                '[contenteditable="true"]',
                '[class*="regenerate"]',
                '[class*="copy-button"]',
                '[data-testid*="copy"]',
                '[data-test-id*="copy"]',
                '[aria-label*="Copy"]',
                '[aria-label*="copy"]',
                '[aria-label*="More"]',
                '[aria-label*="more"]'
            ].join(',');

            queryAll(clone, uiSelector).forEach(element => element.remove());
        }

        function detectLanguage(block) {
            const codeElement = matches(block, 'code') ? block : block.querySelector('code');
            const sources = [
                codeElement?.className,
                block.getAttribute?.('data-language'),
                block.getAttribute?.('language'),
                block.getAttribute?.('lang'),
                codeElement?.getAttribute?.('data-language'),
                codeElement?.getAttribute?.('language'),
                codeElement?.getAttribute?.('lang'),
                block.getAttribute?.('aria-label')
            ].filter(Boolean).map(String);

            for (const source of sources) {
                const languageMatch = source.match(/language-([a-zA-Z0-9_+#.-]+)/);
                if (languageMatch) return languageMatch[1].toLowerCase();
                if (/^[a-zA-Z0-9_+#.-]{1,24}$/.test(source) && !/^(code|copy|download)$/i.test(source)) {
                    return source.toLowerCase();
                }
            }

            const header = block.querySelector('[class*="sticky"], [class*="code-header"], [data-testid*="code"], [data-test-id*="code"], .code-language, .code-lang, [slot="header"]');
            const headerText = normalizeWhitespace(getText(header)).replace(/\b(copy|code|download)\b/gi, '').trim();
            if (headerText && headerText.length < 32 && !headerText.includes('\n')) {
                return headerText.toLowerCase();
            }

            return '';
        }

        function extractCodeBlock(block) {
            const clone = block.cloneNode(true);
            const language = detectLanguage(clone);

            queryAll(clone, 'button, svg, [aria-label*="Copy"], [aria-label*="copy"], [class*="sticky"], [class*="code-header"], [data-testid*="copy"], [data-test-id*="copy"], [slot="header"]').forEach(element => element.remove());

            const cmContent = clone.querySelector('.cm-content');
            if (cmContent) {
                const cmLines = queryAll(cmContent, '.cm-line');
                if (cmLines.length > 0) {
                    return {
                        lang: language,
                        code: normalizeCodeText(cmLines.map(line => line.textContent || '').join('\n'))
                    };
                }

                return {
                    lang: language,
                    code: normalizeCodeText(getCodeText(cmContent))
                };
            }

            const codeElement = matches(clone, 'code') ? clone : clone.querySelector('code');
            return {
                lang: language,
                code: normalizeCodeText(getCodeText(codeElement || clone))
            };
        }

        function formatCodeBlock(block, format, replacements) {
            const { lang, code } = extractCodeBlock(block);

            if (format === 'markdown') {
                return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
            }

            const langClass = lang ? ` class="language-${sanitizeHtml(lang)}"` : '';
            if (format === 'pdf') {
                const label = lang ? `<div class="code-language">${sanitizeHtml(lang)}</div>` : '';
                return addReplacement(replacements, `<pre class="code-block">${label}<code>${sanitizeHtml(code)}</code></pre>`);
            }

            return addReplacement(replacements, `<pre><code${langClass}>${sanitizeHtml(code)}</code></pre>`);
        }

        function processCodeBlocks(clone, format, replacements) {
            const blocks = topLevelElements(queryAll(clone, 'pre, code-block, [data-testid*="code-block"], [data-test-id*="code-block"]'));

            blocks.forEach(block => {
                const replacement = formatCodeBlock(block, format, replacements);
                block.replaceWith(createTextNode(block, replacement));
            });
        }

        function processMath(clone) {
            const processed = new Set();

            queryAll(clone, 'annotation').forEach(annotation => {
                const encoding = (annotation.getAttribute('encoding') || '').toLowerCase();
                if (!encoding.includes('tex') && !encoding.includes('latex')) return;

                const tex = annotation.textContent.trim();
                if (!tex) return;

                const displayRoot = annotation.closest('.katex-display, mjx-container[display="true"], [display="block"]');
                const mathRoot = displayRoot || annotation.closest('.katex') || annotation.closest('mjx-container') || annotation.closest('math');
                if (!mathRoot || processed.has(mathRoot)) return;

                processed.add(mathRoot);
                mathRoot.replaceWith(createTextNode(mathRoot, displayRoot ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
            });

            queryAll(clone, 'script[type^="math/tex"]').forEach(script => {
                const tex = script.textContent.trim();
                if (!tex) return;
                const isDisplay = /mode=display/.test(script.type);
                script.replaceWith(createTextNode(script, isDisplay ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
            });
        }

        function processMedia(clone, format, replacements) {
            queryAll(clone, 'img, canvas, video, audio').forEach(element => {
                const tag = element.tagName.toLowerCase();
                const alt = normalizeWhitespace(element.getAttribute('alt') || element.getAttribute('aria-label') || element.getAttribute('title') || '');
                const label = tag === 'img' && alt ? `[Image: ${alt}]` :
                    tag === 'img' ? '[Image]' :
                    tag === 'canvas' ? '[Canvas or chart]' :
                    tag === 'video' ? '[Video]' :
                    tag === 'audio' ? '[Audio]' :
                    '[Media]';

                const replacement = format === 'markdown'
                    ? label
                    : addReplacement(replacements, `<span class="media-placeholder">${sanitizeHtml(label)}</span>`);
                element.replaceWith(createTextNode(element, replacement));
            });
        }

        function processLinks(clone, format, replacements) {
            queryAll(clone, 'a[href]').forEach(link => {
                if (link.closest('pre, code, code-block')) return;

                const href = String(link.href || link.getAttribute('href') || '').trim();
                if (isUnsafeHref(href)) return;

                const text = normalizeWhitespace(link.textContent) || href;
                const replacement = format === 'markdown'
                    ? `[${escapeMarkdownLinkText(text)}](${escapeMarkdownUrl(href)})`
                    : addReplacement(replacements, `<a href="${sanitizeHtml(href)}">${sanitizeHtml(text)}</a>`);

                link.replaceWith(createTextNode(link, replacement));
            });
        }

        function tableCellText(cell) {
            return normalizeWhitespace(getText(cell)).replace(/\|/g, '\\|') || ' ';
        }

        function tableToMarkdown(table) {
            const rows = queryAll(table, 'tr')
                .map(row => Array.from(row.children)
                    .filter(cell => ['TH', 'TD'].includes(cell.tagName))
                    .map(tableCellText))
                .filter(row => row.length > 0);

            if (rows.length === 0) return normalizeWhitespace(getText(table));

            const width = Math.max(...rows.map(row => row.length));
            const normalizedRows = rows.map(row => row.concat(Array(Math.max(0, width - row.length)).fill(' ')));
            const header = normalizedRows[0];
            const separator = header.map(() => '---');
            const body = normalizedRows.slice(1);

            return [
                `| ${header.join(' | ')} |`,
                `| ${separator.join(' | ')} |`,
                ...body.map(row => `| ${row.join(' | ')} |`)
            ].join('\n');
        }

        function tableToHtml(table) {
            const rows = queryAll(table, 'tr')
                .map(row => Array.from(row.children)
                    .filter(cell => ['TH', 'TD'].includes(cell.tagName))
                    .map(cell => ({
                        tag: cell.tagName.toLowerCase(),
                        text: normalizeWhitespace(getText(cell))
                    })))
                .filter(row => row.length > 0);

            if (rows.length === 0) return sanitizeHtml(getText(table));

            return `<table>${rows.map(row => {
                const cells = row.map(cell => `<${cell.tag}>${sanitizeHtml(cell.text)}</${cell.tag}>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('')}</table>`;
        }

        function processTables(clone, format, replacements) {
            topLevelElements(queryAll(clone, 'table')).forEach(table => {
                const replacement = format === 'markdown'
                    ? `\n\n${tableToMarkdown(table)}\n\n`
                    : addReplacement(replacements, tableToHtml(table));
                table.replaceWith(createTextNode(table, replacement));
            });
        }

        function cardSignal(element) {
            const pieces = [
                element.tagName,
                getClassName(element),
                element.getAttribute('data-testid'),
                element.getAttribute('data-test-id'),
                element.getAttribute('aria-label'),
                element.getAttribute('role')
            ].filter(Boolean).join(' ').toLowerCase();

            if (/\b(artifact|canvas-preview|generated-file|download-card|attachment|file-card)\b/.test(pieces)) {
                return pieces.includes('artifact') || pieces.includes('canvas-preview') ? 'Artifact' : 'File';
            }

            if (/(^|[\s_-])(attachment|file)([\s_-]|$)/.test(pieces)) {
                return 'File';
            }

            return '';
        }

        function cardLabel(element) {
            const candidates = [
                element.getAttribute('aria-label'),
                element.getAttribute('title'),
                element.getAttribute('download'),
                element.getAttribute('data-filename'),
                getText(element)
            ].filter(Boolean).map(normalizeWhitespace);

            const label = candidates.find(value => value && value.length <= 180) || '';
            return label
                .replace(/\b(open|download|preview|file|attachment|artifact)\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function processCards(clone, format, replacements) {
            const cards = topLevelElements(Array.from(clone.querySelectorAll('*')).filter(element => {
                const kind = cardSignal(element);
                if (!kind) return false;
                if (matches(element, '[data-message-author-role], user-query, model-response')) return false;
                if (element.closest('pre, code, code-block, table')) return false;
                if (element.querySelector('pre, code-block, table, user-query, model-response')) return false;

                const text = normalizeWhitespace(getText(element));
                const label = cardLabel(element);
                return Boolean(label || text) && text.length <= 240;
            }));

            cards.forEach(card => {
                const kind = cardSignal(card);
                const label = cardLabel(card);
                const text = label ? `[${kind}: ${label}]` : `[${kind}]`;
                const replacement = format === 'markdown'
                    ? text
                    : addReplacement(replacements, `<span class="card-placeholder">${sanitizeHtml(text)}</span>`);
                card.replaceWith(createTextNode(card, replacement));
            });
        }

        function serializeMarkdownChildren(element, context = {}) {
            return Array.from(element.childNodes).map((node, index) => serializeMarkdownNode(node, {
                ...context,
                index
            })).join('');
        }

        function serializeMarkdownNode(node, context = {}) {
            if (node.nodeType === 3) {
                const value = node.nodeValue || '';
                if (value.includes('```') || value.includes('| ---') || value.includes(MARKER_PREFIX) || value.match(/^\s*\[[^\]]+\]/)) {
                    return value;
                }
                return value.replace(/[ \t\r\n]+/g, ' ');
            }

            if (node.nodeType !== 1) return '';

            const tag = node.tagName.toLowerCase();
            if (['script', 'style', 'button', 'svg'].includes(tag)) return '';
            if (tag === 'br') return '\n';

            if (/^h[1-6]$/.test(tag)) {
                const level = Number(tag.slice(1));
                const content = serializeMarkdownChildren(node, context).trim();
                return content ? `\n\n${'#'.repeat(level)} ${content}\n\n` : '';
            }

            if (tag === 'p') {
                const content = serializeMarkdownChildren(node, context).trim();
                return content ? `\n\n${content}\n\n` : '';
            }

            if (tag === 'blockquote') {
                const content = serializeMarkdownChildren(node, context).trim();
                return content ? `\n\n${content.split('\n').map(line => `> ${line.trim()}`).join('\n')}\n\n` : '';
            }

            if (tag === 'ul' || tag === 'ol') {
                const children = Array.from(node.children).filter(child => child.tagName && child.tagName.toLowerCase() === 'li');
                return `\n${children.map((child, index) => serializeMarkdownNode(child, {
                    ...context,
                    listType: tag,
                    index,
                    depth: (context.depth || 0)
                })).join('')}\n`;
            }

            if (tag === 'li') {
                const depth = context.depth || 0;
                const marker = context.listType === 'ol' ? `${(context.index || 0) + 1}. ` : '- ';
                const indent = '  '.repeat(depth);
                const content = serializeMarkdownChildren(node, {
                    ...context,
                    depth: depth + 1
                }).trim();
                return content ? `${indent}${marker}${content.replace(/\n+/g, `\n${indent}  `)}\n` : '';
            }

            if (['strong', 'b'].includes(tag)) {
                const content = serializeMarkdownChildren(node, context).trim();
                return content ? `**${content}**` : '';
            }

            if (['em', 'i'].includes(tag)) {
                const content = serializeMarkdownChildren(node, context).trim();
                return content ? `*${content}*` : '';
            }

            if (tag === 'code') {
                const content = getCodeText(node).replace(/`/g, '\\`').trim();
                return content ? `\`${content}\`` : '';
            }

            const content = serializeMarkdownChildren(node, context);
            if (['div', 'section', 'article', 'main', 'message-content', 'model-response', 'user-query', 'response-element'].includes(tag)) {
                return content;
            }

            return content;
        }

        function serializeHtmlChildren(element, replacements) {
            return Array.from(element.childNodes).map(node => serializeHtmlNode(node, replacements)).join('');
        }

        function serializeHtmlNode(node, replacements) {
            if (node.nodeType === 3) {
                return sanitizeHtml(node.nodeValue || '');
            }

            if (node.nodeType !== 1) return '';

            const tag = node.tagName.toLowerCase();
            if (['script', 'style', 'button', 'svg'].includes(tag)) return '';
            if (tag === 'br') return '<br>';

            const content = serializeHtmlChildren(node, replacements);
            const blockTags = new Set(['p', 'ul', 'ol', 'li', 'blockquote', 'strong', 'b', 'em', 'i']);

            if (/^h[1-6]$/.test(tag)) {
                return `<${tag}>${content}</${tag}>`;
            }

            if (blockTags.has(tag)) {
                const safeTag = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
                return `<${safeTag}>${content}</${safeTag}>`;
            }

            if (tag === 'code') {
                return `<code>${sanitizeHtml(getCodeText(node).trim())}</code>`;
            }

            if (['div', 'section', 'article', 'main', 'span', 'message-content', 'model-response', 'user-query', 'response-element'].includes(tag)) {
                return content;
            }

            return content;
        }

        function serializeMessageContent(element, format) {
            const clone = element.cloneNode(true);
            const replacements = [];

            removeUiElements(clone);
            processCards(clone, format, replacements);
            processCodeBlocks(clone, format, replacements);
            processMath(clone);
            processMedia(clone, format, replacements);
            processLinks(clone, format, replacements);
            processTables(clone, format, replacements);

            if (format === 'markdown') {
                return cleanMarkdown(serializeMarkdownChildren(clone));
            }

            const html = serializeHtmlChildren(clone, replacements)
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            return restoreReplacements(html, replacements);
        }

        function detectProvider(doc) {
            const url = doc.defaultView?.location?.href || '';
            if (/gemini\.google\.com/i.test(url) || doc.querySelector('user-query, model-response')) return 'gemini';
            return 'chatgpt';
        }

        function providerFor(providerName, doc) {
            const id = providerName || detectProvider(doc);
            return PROVIDERS[id] || PROVIDERS.chatgpt;
        }

        function meaningfulScore(element) {
            const richCount = queryAll(element, 'pre, code-block, table, img, canvas, video, audio, annotation, script[type^="math/tex"]').length;
            return normalizeWhitespace(element.textContent).length + richCount * 200;
        }

        function isValidMessage(element) {
            const text = normalizeWhitespace(element.textContent);
            const richCount = queryAll(element, 'pre, code-block, table, img, canvas, video, audio, annotation, script[type^="math/tex"]').length;

            if (text.length < 5 && richCount === 0) return false;
            if (text.length > 200000) return false;
            if (matches(element, 'nav, aside, header, footer, form, menu')) return false;
            if (element.querySelector('textarea, input[type="text"], [contenteditable="true"]') && !element.hasAttribute('data-message-author-role')) return false;
            if (getClassName(element).match(/\b(typing|loading|spinner)\b/i)) return false;

            return true;
        }

        function findMessages(doc, provider) {
            for (const selector of provider.messageSelectors) {
                const messages = topLevelElements(queryAll(doc, selector)).filter(isValidMessage);
                if (messages.length > 0) {
                    console.log(`[Chat Exporter] ${provider.id}: using selector "${selector}" (${messages.length} messages)`);
                    return messages;
                }
            }

            const container = doc.querySelector('[role="main"], main, [class*="conversation"], [class*="chat"]');
            if (!container) return [];

            return topLevelElements(queryAll(container, ':scope > article, :scope > section, :scope > div')).filter(isValidMessage);
        }

        function selectContentRoot(messageElement, provider) {
            const candidates = [messageElement];

            provider.contentSelectors.forEach(selector => {
                if (matches(messageElement, selector)) candidates.push(messageElement);
                candidates.push(...queryAll(messageElement, selector));
            });

            return candidates
                .filter(Boolean)
                .sort((a, b) => meaningfulScore(b) - meaningfulScore(a))[0] || messageElement;
        }

        function identifySender(element, index, provider) {
            const tag = element.tagName.toLowerCase();
            if (tag === 'user-query') return { sender: 'You', reliable: true };
            if (tag === 'model-response') return { sender: provider.assistantName, reliable: true };

            const role = element.getAttribute('data-message-author-role') || element.getAttribute('data-author') || element.getAttribute('data-sender');
            if (role) {
                const normalizedRole = role.toLowerCase();
                if (normalizedRole === 'user') return { sender: 'You', reliable: true };
                if (['assistant', 'model', 'bot', 'chatgpt', 'gemini'].includes(normalizedRole)) {
                    return { sender: provider.assistantName, reliable: true };
                }
            }

            const classAndAttrs = [
                getClassName(element),
                element.getAttribute('aria-label'),
                element.getAttribute('data-testid'),
                element.getAttribute('data-test-id')
            ].filter(Boolean).join(' ').toLowerCase();

            if (classAndAttrs.match(/\b(user|human|query)\b/)) return { sender: 'You', reliable: false };
            if (classAndAttrs.match(/\b(assistant|model|response|chatgpt|gemini|bard)\b/)) return { sender: provider.assistantName, reliable: false };

            const textStart = normalizeWhitespace(element.textContent).slice(0, 220).toLowerCase();
            if (/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course|absolutely)/.test(textStart)) {
                return { sender: provider.assistantName, reliable: false };
            }

            if (/^(can you|please help|how do i|i need|i want|help me|could you|explain|what is)/.test(textStart)) {
                return { sender: 'You', reliable: false };
            }

            return { sender: index % 2 === 0 ? 'You' : provider.assistantName, reliable: false };
        }

        function contentHash(content) {
            return normalizeWhitespace(String(content || '').replace(/<[^>]+>/g, ' ')).slice(0, 160);
        }

        function extractConversation(options = {}) {
            const doc = resolveDocument(options.document);
            const provider = providerFor(options.provider, doc);
            const format = options.format || 'markdown';
            const rawMessages = findMessages(doc, provider);
            const seen = new Set();
            const messages = [];

            rawMessages.forEach((messageElement, index) => {
                const contentRoot = selectContentRoot(messageElement, provider);
                const content = serializeMessageContent(contentRoot, format);
                const minLength = queryAll(contentRoot, 'pre, code-block, table, img, canvas, video, audio').length > 0 ? 3 : 10;

                if (!content || content.replace(/<[^>]*>/g, '').trim().length < minLength) return;

                const hash = contentHash(content);
                if (seen.has(hash)) return;
                seen.add(hash);

                const sender = identifySender(messageElement, index, provider);
                messages.push({
                    sender: sender.sender,
                    senderType: sender.sender === 'You' ? 'user' : 'assistant',
                    reliableSender: sender.reliable,
                    content,
                    index
                });
            });

            return {
                version: ENGINE_VERSION,
                provider: provider.id,
                providerLabel: provider.assistantName,
                sourceLabel: provider.sourceLabel,
                title: extractConversationTitle(doc, provider),
                sourceUrl: doc.defaultView?.location?.href || '',
                date: formatDate(options.date || new Date()),
                messages
            };
        }

        function extractConversationTitle(doc, provider) {
            for (const selector of provider.titleSelectors) {
                const element = doc.querySelector(selector);
                const title = normalizeWhitespace(element?.textContent);
                if (title && !provider.genericTitlePattern.test(title)) return title;
            }

            const docTitle = normalizeWhitespace(doc.title);
            if (docTitle && !provider.genericTitlePattern.test(docTitle)) return docTitle;

            return provider.defaultTitle;
        }

        function renderMarkdown(conversation) {
            const lines = [
                `# ${conversation.title}\n`,
                `**Date:** ${conversation.date}`,
                `**Source:** [${conversation.sourceLabel}](${conversation.sourceUrl})\n`,
                '---\n'
            ];

            conversation.messages.forEach(message => {
                lines.push(`### **${message.sender}**\n`, message.content, '\n---\n');
            });

            return `${lines.join('\n').trim()}\n`;
        }

        function renderHtmlDocument(conversation, options = {}) {
            const isPdf = options.format === 'pdf';
            const source = sanitizeHtml(conversation.sourceUrl);
            const title = sanitizeHtml(conversation.title);
            const messages = conversation.messages.map(message => {
                const senderClass = message.senderType === 'user' ? 'user' : 'assistant';
                return `
            <div class="message ${senderClass}">
                <div class="sender">${sanitizeHtml(message.sender)}</div>
                <div class="content">${message.content}</div>
            </div>`;
            }).join('');

            const pdfInstructions = isPdf ? `
        <div class="instructions no-print">
            <h3>Convert to PDF</h3>
            <ol>
                <li>Press Ctrl+P on Windows/Linux or Cmd+P on Mac.</li>
                <li>Set Destination to Save as PDF.</li>
                <li>Choose your preferred page size.</li>
                <li>Click Save.</li>
            </ol>
            <p><em>This instruction box will not appear in the PDF.</em></p>
        </div>` : '';

            return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${title} - ${conversation.date}</title>
        <style>
            @media print {
                body { margin: 0; }
                .no-print { display: none; }
                .message { page-break-inside: avoid; }
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                max-width: 840px;
                margin: auto;
                padding: 2rem;
                background: #fff;
                color: #333;
                line-height: 1.6;
            }
            .header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #eee;
            }
            .metadata {
                color: #666;
                font-size: 0.9rem;
            }
            .message {
                margin-bottom: 1.5rem;
                padding: 1rem;
                border-radius: 8px;
                background: #f8f9fa;
            }
            .message.user {
                background: #eaf4ff;
            }
            .sender {
                font-weight: 700;
                color: #2c3e50;
                margin-bottom: 0.5rem;
            }
            .content {
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }
            pre {
                background: #f4f4f4;
                padding: 1rem;
                border-radius: 4px;
                overflow-x: auto;
                border-left: 4px solid #007acc;
            }
            .code-block {
                background: #282c34;
                color: #abb2bf;
                border-left: 0;
            }
            .code-block code {
                white-space: pre;
            }
            .code-language {
                color: #d7dae0;
                font-size: 12px;
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            code {
                font-family: Consolas, Monaco, "Courier New", monospace;
                font-size: 0.92rem;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
            }
            th, td {
                border: 1px solid #d9dde3;
                padding: 0.5rem;
                text-align: left;
                vertical-align: top;
            }
            th {
                background: #eef2f7;
            }
            .instructions {
                background: #fff8dc;
                border: 1px solid #e3c565;
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1.5rem;
            }
        </style>
    </head>
    <body>
        ${pdfInstructions}
        <div class="header">
            <h1>${title}</h1>
            <div class="metadata">
                <div><strong>Date:</strong> ${sanitizeHtml(conversation.date)}</div>
                <div><strong>Source:</strong> <a href="${source}">${sanitizeHtml(conversation.sourceLabel)}</a></div>
                <div><strong>Messages:</strong> ${conversation.messages.length}</div>
            </div>
        </div>
        <div class="conversation">${messages}
        </div>
    </body>
    </html>`;
        }

        function render(conversation, format) {
            if (format === 'markdown') return renderMarkdown(conversation);
            if (format === 'pdf') return renderHtmlDocument(conversation, { format: 'pdf' });
            if (format === 'html') return renderHtmlDocument(conversation, { format: 'html' });
            throw new Error(`Unsupported export format: ${format}`);
        }

        function filenameFor(conversation, format, doc) {
            const safeTitle = normalizeWhitespace(doc.title || conversation.title)
                .replace(/[<>:"/\\|?*]/g, '')
                .slice(0, 120);

            if (format === 'markdown') {
                return safeTitle ? `${safeTitle} (${conversation.date}).md` : `${conversation.providerLabel}_Conversation_${conversation.date}.md`;
            }

            if (format === 'pdf') {
                return safeTitle ? `${safeTitle} (${conversation.date}) - PrintToPDF.html` : `${conversation.providerLabel}_Conversation_${conversation.date}_PrintToPDF.html`;
            }

            return safeTitle ? `${safeTitle} (${conversation.date}).html` : `${conversation.providerLabel}_Conversation_${conversation.date}.html`;
        }

        function mimeFor(format) {
            return format === 'markdown' ? 'text/markdown' : 'text/html';
        }

        function downloadFile(doc, content, filename, mimeType) {
            const win = getWindow(doc);
            const BlobCtor = win?.Blob || Blob;
            const urlApi = win?.URL || URL;
            const blob = new BlobCtor([content], { type: mimeType });
            const url = urlApi.createObjectURL(blob);
            const anchor = doc.createElement('a');

            anchor.href = url;
            anchor.download = filename;
            doc.body.appendChild(anchor);
            anchor.click();
            doc.body.removeChild(anchor);
            urlApi.revokeObjectURL(url);
        }

        function exportConversation(options = {}) {
            const doc = resolveDocument(options.document);
            const format = options.format || 'markdown';
            const conversation = extractConversation({
                ...options,
                document: doc,
                format
            });

            if (conversation.messages.length === 0) {
                const message = 'No messages found. The page structure may have changed.';
                const win = getWindow(doc);
                if (typeof win?.alert === 'function') win.alert(message);
                console.warn(`[Chat Exporter] ${message}`);
                return { conversation, content: '' };
            }

            const content = render(conversation, format);
            const filename = options.filename || filenameFor(conversation, format, doc);

            if (options.download !== false) {
                downloadFile(doc, content, filename, mimeFor(format));
                console.log(`[Chat Exporter] Exported ${conversation.messages.length} messages to ${filename}`);
            }

            return { conversation, content, filename };
        }

        return {
            version: ENGINE_VERSION,
            providers: PROVIDERS,
            detectProvider,
            extractConversation,
            exportConversation,
            serializers: {
                markdown: renderMarkdown,
                html: conversation => renderHtmlDocument(conversation, { format: 'html' }),
                pdf: conversation => renderHtmlDocument(conversation, { format: 'pdf' })
            },
            internals: {
                serializeMessageContent,
                extractCodeBlock,
                tableToMarkdown,
                tableToHtml
            }
        };
    });

    globalThis.ChatExporterEngine.exportConversation({
        provider: 'chatgpt',
        format: 'html'
    });
})();
