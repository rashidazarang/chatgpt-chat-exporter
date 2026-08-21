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

    const ENGINE_VERSION = '0.12.1';

    // Pixels of slack when deciding the scroll container has reached its end.
    const BOTTOM_TOLERANCE = 4;

    // Scroll steps that neither advance nor capture anything before the sweep
    // gives up, so a virtualizer that drags scrollTop backwards gets retries.
    const MAX_SCROLL_STALLS = 5;

    // Wall-clock budget for a full sweep. Step counts alone can't bound it —
    // a provider that keeps changing height would hold the page for minutes.
    const DEFAULT_MAX_DURATION = 120000;

    // How long to watch the newest answer before deciding it has stopped
    // growing. Short enough not to be felt on an idle conversation.
    const STREAM_SETTLE_INTERVAL = 250;

    // How long the conversation container must stop mutating before a scroll
    // step counts as rendered. The sweep used to sleep a fixed scrollDelay per
    // step whether or not the virtualizer had already finished — on a long
    // conversation that is most of the export's wall clock.
    const RENDER_QUIET_INTERVAL = 60;

    // Total time the sweep will wait for a hidden tab to come back before
    // giving up and exporting what is on the page. Separate from maxDuration:
    // waiting on the reader is not the export spending its budget.
    const MAX_HIDDEN_WAIT = 60000;

    // How often a long sweep says where it has got to. Minutes of silence read
    // as a hang.
    const PROGRESS_INTERVAL = 5000;
    // Random run token so conversation text can never collide with (or inject
    // through) the internal block placeholders used during serialization.
    const MARKER_PREFIX = `__CHAT_EXPORTER_BLOCK_${Math.random().toString(36).slice(2, 10)}_`;

    // The element that owns one turn — the message plus whatever the provider
    // renders beside it. ChatGPT puts uploaded media outside the role node, so
    // the turn wrapper is what has to be read (issues #32, #33). This is a
    // per-provider concept and lives in PROVIDERS below; a provider whose
    // message element *is* the whole turn names that element instead.
    const CHATGPT_TURN_SELECTOR = [
        'section[data-testid^="conversation-turn-"]',
        'article[data-testid*="conversation-turn"]',
        'div[data-testid^="conversation-turn-"]',
        'div[data-testid="conversation-turn"]',
        '.group\\/conversation-turn'
    ].join(', ');

    // Gemini's own wrapper, .conversation-container, holds a *pair* — one
    // user-query and one model-response. Scoping a message to it would hand
    // both turns to selectContentRoot, which sorts candidates by text length:
    // the pair would win and every answer would be prefixed with its question.
    // The message element is the turn here.
    const GEMINI_TURN_SELECTOR = 'user-query, model-response';

    const MESSAGE_TIMESTAMP_SELECTOR = [
        'time[datetime]',
        'time[data-testid*="timestamp"]',
        '[data-message-timestamp]',
        '[data-created-at]',
        '[data-create-time]'
    ].join(', ');

    const METADATA_FETCH_TIMEOUT = 5000;
    const METADATA_MAX_DURATION = 15000;
    const MAX_EMBEDDED_IMAGE_BYTES = 20 * 1024 * 1024;
    const MAX_TOTAL_EMBEDDED_IMAGE_BYTES = 50 * 1024 * 1024;

    // ChatGPT's private API is reached through the page's own session. The
    // bearer token the app uses lives behind the session endpoint; the accounts
    // endpoint names the workspaces the reader may act as.
    const CHATGPT_SESSION_ENDPOINT = '/api/auth/session';
    const CHATGPT_ACCOUNTS_ENDPOINT = '/backend-api/accounts/check/v4-2023-04-27';

    // A refused request comes back as 404 carrying one of these codes instead
    // of 401/403, so the status line alone cannot say why it failed.
    const CHATGPT_AUTH_ERROR_CODES = new Set([
        'conversation_inaccessible',
        'account_deactivated',
        'unauthorized',
        'invalid_token',
        'token_expired'
    ]);

    const PROVIDERS = {
        chatgpt: {
            id: 'chatgpt',
            assistantName: 'ChatGPT',
            sourceLabel: 'chatgpt.com',
            defaultTitle: 'Conversation with ChatGPT',
            genericTitlePattern: /^(chatgpt|new chat|untitled|chat)$/i,
            turnSelector: CHATGPT_TURN_SELECTOR,
            documentTitleSuffix: /\s*[-–—|]\s*ChatGPT\s*$/i,
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
            // ChatGPT keeps the conversation name in document.title. Its
            // message bodies also contain ordinary h1 elements, so preferring
            // the selector cascade makes the title depend on which virtualized
            // answer happens to be mounted when export starts.
            preferDocumentTitle: true,
            titleSelectors: [
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
            turnSelector: GEMINI_TURN_SELECTOR,
            // Live Gemini titles its tab "<name> - Google Gemini"; every
            // titleSelector below misses, so that suffix reached the export
            // and the filename verbatim.
            documentTitleSuffix: /\s*[-–—|]\s*(?:Google\s+)?Gemini\s*$/i,
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
            // Verified live: Gemini's tab title IS the conversation name, and
            // nothing in its DOM reliably carries it. [class*="conversation-title"]
            // matched the model picker and exported a conversation titled
            // "Flash-Lite", so it is gone rather than merely outranked.
            preferDocumentTitle: true,
            titleSelectors: [
                'h1:not([class*="hidden"])',
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

    function now(win) {
        const clock = win?.performance || (typeof performance !== 'undefined' ? performance : null);
        return typeof clock?.now === 'function' ? clock.now() : Date.now();
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

    function messageScope(element, provider) {
        const selector = provider?.turnSelector;
        if (!element || !selector || typeof element.closest !== 'function') return element;
        try {
            return element.closest(selector) || element;
        } catch (error) {
            return element;
        }
    }

    function providerMessageId(element, provider) {
        const scope = messageScope(element, provider);
        const carrier = [element, scope, scope?.querySelector?.('[data-message-id], [data-message-uuid]')]
            .find(candidate => candidate?.getAttribute?.('data-message-id') || candidate?.getAttribute?.('data-message-uuid'));
        return carrier?.getAttribute('data-message-id') || carrier?.getAttribute('data-message-uuid') || '';
    }

    function timestampIso(value) {
        if (value === null || value === undefined || value === '') return '';

        let date;
        if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric) || numeric <= 0) return '';
            date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
        } else {
            date = new Date(String(value));
        }

        return Number.isNaN(date.getTime()) ? '' : date.toISOString();
    }

    function formatMessageTimestamp(value, doc) {
        const iso = timestampIso(value);
        if (!iso) return '';

        const date = new Date(iso);
        const win = getWindow(doc);
        const DateTimeFormat = win?.Intl?.DateTimeFormat || Intl.DateTimeFormat;
        try {
            return new DateTimeFormat(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }).format(date);
        } catch (error) {
            return iso;
        }
    }

    function extractMessageTimestamp(element, provider) {
        const scope = messageScope(element, provider);
        const timeElement = scope?.querySelector?.(MESSAGE_TIMESTAMP_SELECTOR) || null;
        const sources = [timeElement, element, scope].filter(Boolean);
        let raw = '';

        for (const source of sources) {
            raw = source.getAttribute?.('datetime') ||
                source.getAttribute?.('data-message-timestamp') ||
                source.getAttribute?.('data-created-at') ||
                source.getAttribute?.('data-create-time') || '';
            if (raw) break;
        }

        const iso = timestampIso(raw);
        const visible = normalizeWhitespace(
            timeElement?.textContent ||
            timeElement?.getAttribute?.('aria-label') ||
            timeElement?.getAttribute?.('title') || ''
        );

        if (!iso && !visible) return null;
        return {
            timestamp: visible || formatMessageTimestamp(iso, element?.ownerDocument),
            timestampIso: iso
        };
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

        // innerText is unreliable here: serialization works on detached clones,
        // where browsers fall back to textContent and drop the line breaks that
        // come from element boundaries or <br> tags (issue #25).
        const clone = element.cloneNode(true);
        queryAll(clone, 'br').forEach(br => br.replaceWith(clone.ownerDocument.createTextNode('\n')));
        return collectTextWithBreaks(clone).replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trimEnd();
    }

    function normalizeCodeText(value) {
        return String(value ?? '')
            .replace(/\r\n?/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/^\n+/, '')
            .replace(/\n+$/, '');
    }

    function isPreWrapElement(element) {
        if (!element || element.nodeType !== 1) return false;
        if (element.hasAttribute?.('data-chat-exporter-pre-wrap')) return true;
        if (getClassName(element).includes('whitespace-pre-wrap')) return true;
        const style = element.getAttribute?.('style') || '';
        return /white-space\s*:\s*(pre-wrap|break-spaces)/i.test(style);
    }

    // Clones lose stylesheet-driven formatting, so inspect the live tree and
    // tag elements whose computed white-space preserves author line breaks.
    // cloneNode(true) yields an identical tree order, letting both element
    // lists line up index-for-index.
    function annotatePreWrapElements(original, clone) {
        const win = original?.ownerDocument ? getWindow(original.ownerDocument) : null;
        if (!win || typeof win.getComputedStyle !== 'function') return;

        const originalElements = [original, ...queryAll(original, '*')];
        const cloneElements = [clone, ...queryAll(clone, '*')];

        originalElements.forEach((element, index) => {
            const cloneElement = cloneElements[index];
            if (!cloneElement || typeof cloneElement.setAttribute !== 'function') return;

            try {
                const whiteSpace = win.getComputedStyle(element)?.whiteSpace || '';
                if (whiteSpace === 'pre-wrap' || whiteSpace === 'break-spaces') {
                    cloneElement.setAttribute('data-chat-exporter-pre-wrap', '');
                }
            } catch (error) {
                // Computed style can fail on foreign elements; class and inline
                // style detection in isPreWrapElement still applies.
            }
        });
    }

    function preWrapText(element) {
        return collectTextWithBreaks(element)
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\n+/, '')
            .trimEnd();
    }

    function markdownFenceFor(code) {
        const runs = String(code ?? '').match(/`{3,}/g) || [];
        const longest = runs.reduce((max, run) => Math.max(max, run.length), 2);
        return '`'.repeat(longest + 1);
    }

    function safeInfoString(lang) {
        return String(lang || '').replace(/[^a-zA-Z0-9_+#.-]/g, '');
    }

    function createTextNode(reference, text) {
        return reference.ownerDocument.createTextNode(text);
    }

    function addReplacement(replacements, value) {
        const marker = `${MARKER_PREFIX}${replacements.length}__`;
        replacements.push({ marker, value });
        return marker;
    }

    function restoreReplacements(value, replacements) {
        return replacements.reduce((result, replacement) => result.replaceAll(replacement.marker, replacement.value), value);
    }

    function splitMarkdownFencedBlocks(value) {
        const source = String(value ?? '');
        const pattern = /(?:^|\n)(`{3,})[^\n]*\n[\s\S]*?\n\1(?=\n|$)/g;
        const segments = [];
        let cursor = 0;
        let match;

        while ((match = pattern.exec(source)) !== null) {
            if (match.index > cursor) {
                segments.push({ type: 'text', value: source.slice(cursor, match.index) });
            }

            segments.push({ type: 'code', value: match[0] });
            cursor = match.index + match[0].length;
        }

        if (cursor < source.length) {
            segments.push({ type: 'text', value: source.slice(cursor) });
        }

        return segments;
    }

    // Only trims trailing whitespace and collapses blank-line runs. Leading
    // indentation is intentional (nested lists), and text extracted from the
    // DOM is already entity-decoded, so un-escaping here would corrupt
    // conversations that literally discuss &amp;-style entities.
    function cleanMarkdownText(value) {
        return String(value ?? '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n (?=\S)/g, '\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    function cleanMarkdown(markdown) {
        return splitMarkdownFencedBlocks(markdown)
            .map(segment => segment.type === 'code' ? segment.value : cleanMarkdownText(segment.value))
            .join('')
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
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\s/g, '%20');
    }

    function isUnsafeHref(href) {
        // Browsers ignore whitespace and control characters inside a scheme, so
        // "java\tscript:…" navigates just fine — strip them before testing or
        // the check is trivially bypassed.
        const lower = String(href || '').replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
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
            // MathJax v2 keeps its TeX source in <script type="math/tex">, and
            // this ran before processMath — so that source was stripped before
            // anything could read it, and the branch handling it was dead code.
            'script:not([type^="math/tex"])',
            'textarea',
            'input',
            '[contenteditable="true"]',
            // Screen-reader-only labels are not conversation content. ChatGPT
            // puts "ChatGPT said:" / "You said:" in an h4.sr-only sized 1x1px,
            // which reached every exported message as a redundant "####"
            // heading. Matched by class rather than by text, so a message that
            // legitimately ends a heading with "said:" is untouched.
            '[class*="sr-only"]',
            '[class*="visually-hidden"]',
            '[class*="visuallyhidden"]',
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
            const fence = markdownFenceFor(code);
            return `\n\n${fence}${safeInfoString(lang)}\n${code}\n${fence}\n\n`;
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

    // Every renderer in use puts the TeX source somewhere different, and each
    // one also emits a *visual* duplicate of the same formula. Miss the source
    // and you do not merely lose the markup — you serialize the duplicate too,
    // and the export reads "f(x∣μ)f(x∣μ)".
    const MATH_ROOT_SELECTOR = '[data-math], [data-latex], [data-tex], [data-formula], .katex-display, mjx-container[display="true"], [display="block"], .katex, mjx-container, math';
    // Rendered-for-the-eye copies. KaTeX and MathJax both mark theirs; dropping
    // them leaves exactly one representation behind.
    const MATH_VISUAL_DUPLICATE = '.katex-html, mjx-container [aria-hidden="true"], annotation-xml[encoding*="MathML" i]';

    function texFromNode(node) {
        // 1. MathML <annotation encoding="application/x-tex"> — KaTeX, MathJax v3.
        for (const annotation of queryAll(node, 'annotation, annotation-xml')) {
            const encoding = (annotation.getAttribute('encoding') || '').toLowerCase();
            if (!encoding.includes('tex')) continue;
            const tex = normalizeCodeText(annotation.textContent).trim();
            if (tex) return tex;
        }
        // 2. Source kept on the element — several renderers and ChatGPT itself.
        // Gemini uses data-math, on the wrapper *around* the rendered KaTeX.
        for (const attribute of ['data-math', 'data-latex', 'data-tex', 'data-formula']) {
            const value = node.getAttribute?.(attribute);
            if (value && value.trim()) return value.trim();
        }
        // 3. MathJax v2 left the source in a script tag beside the render.
        const script = node.querySelector?.('script[type^="math/tex"]');
        if (script) {
            const tex = normalizeCodeText(script.textContent).trim();
            if (tex) return tex;
        }
        return '';
    }

    function isDisplayMath(node) {
        if (matches(node, '.katex-display, mjx-container[display="true"], [display="block"], [class*="math-block"]')) return true;
        if (node.closest?.('.katex-display, mjx-container[display="true"]')) return true;
        // A source-carrying wrapper sits *outside* the rendered block, so the
        // display marker is a descendant rather than an ancestor.
        if (node.querySelector?.('.katex-display, mjx-container[display="true"]')) return true;
        return String(node.getAttribute?.('display') || '').toLowerCase() === 'block';
    }

    function processMath(clone) {
        const handled = new Set();

        topLevelElements(queryAll(clone, MATH_ROOT_SELECTOR)).forEach(root => {
            if (handled.has(root)) return;
            handled.add(root);

            const tex = texFromNode(root);
            if (tex) {
                root.replaceWith(createTextNode(root, isDisplayMath(root) ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
                return;
            }

            // No TeX anywhere. Drop the visual copy *only* if an accessible one
            // survives it. Gemini renders KaTeX as .katex-html alone — with no
            // MathML beside it — so removing the duplicate there would delete
            // the formula rather than de-duplicate it.
            if (root.querySelector?.('.katex-mathml, math, mjx-assistive-mml')) {
                queryAll(root, MATH_VISUAL_DUPLICATE).forEach(duplicate => duplicate.remove());
            }
        });

        // A bare script left outside any renderer wrapper.
        queryAll(clone, 'script[type^="math/tex"]').forEach(script => {
            const tex = normalizeCodeText(script.textContent).trim();
            if (!tex) return;
            script.replaceWith(createTextNode(script, /mode=display/.test(script.type) ? `\n\n$$${tex}$$\n\n` : `$${tex}$`));
        });
    }

    function isSafeEmbeddedImageSource(source) {
        const value = String(source || '');
        if (!/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(value)) return false;
        const payload = value.slice(value.indexOf(',') + 1).replace(/\s/g, '');
        return Math.ceil(payload.length * 3 / 4) <= MAX_EMBEDDED_IMAGE_BYTES;
    }

    function isSafeRemoteImageSource(source) {
        try {
            const protocol = new URL(String(source || '')).protocol.toLowerCase();
            return protocol === 'https:' || protocol === 'http:';
        } catch (error) {
            return false;
        }
    }

    function canvasDataUrl(element) {
        try {
            const CanvasRenderingContext2D = element.ownerDocument?.defaultView?.CanvasRenderingContext2D;
            if (typeof CanvasRenderingContext2D !== 'function') return '';

            if (element.tagName?.toLowerCase() === 'canvas') {
                const value = element.toDataURL?.('image/png') || '';
                return isSafeEmbeddedImageSource(value) ? value : '';
            }

            const width = element.naturalWidth || element.width || 0;
            const height = element.naturalHeight || element.height || 0;
            if (!width || !height) return '';

            const canvas = element.ownerDocument?.createElement?.('canvas');
            const context = canvas?.getContext?.('2d');
            if (!canvas || !context) return '';
            canvas.width = width;
            canvas.height = height;
            context.drawImage(element, 0, 0, width, height);
            const value = canvas.toDataURL('image/png');
            return isSafeEmbeddedImageSource(value) ? value : '';
        } catch (error) {
            // Cross-origin images can taint a canvas. Their original HTTPS URL
            // is still a useful fallback, while blob URLs are not portable.
            return '';
        }
    }

    function mediaSource(element) {
        if (element.hasAttribute?.('data-chat-exporter-media-source')) {
            return element.getAttribute('data-chat-exporter-media-source') || '';
        }

        const direct = String(
            element.currentSrc ||
            element.getAttribute?.('src') ||
            element.getAttribute?.('data-src') || ''
        ).trim();
        if (isSafeEmbeddedImageSource(direct)) return direct;

        const embedded = canvasDataUrl(element);
        if (embedded) return embedded;

        const resolved = String(element.src || direct).trim();
        return isSafeRemoteImageSource(resolved) ? resolved : '';
    }

    function annotateMediaSources(original, clone) {
        const originalMedia = queryAll(original, 'img, canvas');
        const clonedMedia = queryAll(clone, 'img, canvas');
        originalMedia.forEach((element, index) => {
            const cloneElement = clonedMedia[index];
            if (!cloneElement) return;
            cloneElement.setAttribute('data-chat-exporter-media-source', mediaSource(element));
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

            const source = (tag === 'img' || tag === 'canvas') ? mediaSource(element) : '';
            const imageAlt = alt || (tag === 'canvas' ? 'Canvas or chart' : 'Image');

            const replacement = format === 'markdown' ?
                (source ? `![${escapeMarkdownLinkText(imageAlt)}](${escapeMarkdownUrl(source)})` : label) :
                addReplacement(replacements, source ?
                    `<img class="exported-media" src="${sanitizeHtml(source)}" alt="${sanitizeHtml(imageAlt)}">` :
                    `<span class="media-placeholder">${sanitizeHtml(label)}</span>`);
            element.replaceWith(createTextNode(element, replacement));
        });
    }

    // Markdown this pass generated for media sitting inside a link. Media is
    // processed first, so by the time a link is serialized its text already
    // contains `![alt](src)` or a `[Image: name]` placeholder.
    const GENERATED_IMAGE_MARKDOWN = /!\[[^\]]*\]\([^)]*\)/g;
    const GENERATED_MEDIA_PLACEHOLDER = /\[(?:Image|Canvas or chart|Video|Audio|Media)(?::[^\]]*)?\]/g;

    // ChatGPT's inline citations are a favicon plus a label inside one link.
    // Escaping the image markdown into the link text produced
    // `[!\[Image\](data:image/png;base64,…)Label](url)` — not a link at all,
    // just a wall of base64 rendered as visible text. Take the label instead,
    // and keep the image only when it is all the link has.
    function markdownLink(link, href) {
        const raw = String(link.textContent || '');
        const images = raw.match(GENERATED_IMAGE_MARKDOWN) || [];
        const label = normalizeWhitespace(
            raw.replace(GENERATED_IMAGE_MARKDOWN, ' ').replace(GENERATED_MEDIA_PLACEHOLDER, ' ')
        );

        if (label) return `[${escapeMarkdownLinkText(label)}](${escapeMarkdownUrl(href)})`;
        // Nothing but an image: nest it properly rather than escaping our own
        // syntax, so the picture survives and the link still works.
        if (images.length > 0) return `[${images[0]}](${escapeMarkdownUrl(href)})`;
        return `[${escapeMarkdownLinkText(href)}](${escapeMarkdownUrl(href)})`;
    }

    function processLinks(clone, format, replacements) {
        queryAll(clone, 'a[href]').forEach(link => {
            if (link.closest('pre, code, code-block')) return;

            const href = String(link.href || link.getAttribute('href') || '').trim();
            if (isUnsafeHref(href)) return;

            // HTML keeps its media as opaque placeholders, so nesting is
            // already correct there — <a><img></a> needs no special handling.
            const replacement = format === 'markdown'
                ? markdownLink(link, href)
                : addReplacement(replacements, `<a href="${sanitizeHtml(href)}">${sanitizeHtml(normalizeWhitespace(link.textContent) || href)}</a>`);

            link.replaceWith(createTextNode(link, replacement));
        });
    }

    function tableCellText(cell) {
        // Escape only the structural pipe character; doubling backslashes here
        // garbled cells that legitimately contain them, such as paths or
        // escape sequences (issue #25).
        return normalizeWhitespace(getText(cell))
            .replace(/\|/g, '\\|') || ' ';
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
        const contentClone = element.cloneNode(true);
        queryAll(contentClone, 'button, [data-testid*="copy"], [data-test-id*="copy"], [aria-label*="Copy"], [aria-label*="copy"]').forEach(action => action.remove());
        const candidates = [
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('download'),
            element.getAttribute('data-filename'),
            getText(contentClone),
            getText(element)
        ].filter(Boolean).map(normalizeWhitespace);

        const label = candidates.find(value => value && value.length <= 180) || '';
        return label
            .replace(/\b(open|download|preview|file|attachment|artifact)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function cardHref(element) {
        const link = matches(element, 'a[href]') ? element : element.querySelector('a[href]');
        if (!link) return '';
        const href = String(link.getAttribute('href') || link.href || '').trim();
        return isUnsafeHref(href) ? '' : href;
    }

    function processCards(clone, format, replacements) {
        const cards = topLevelElements(Array.from(clone.querySelectorAll('*')).filter(element => {
            const kind = cardSignal(element);
            if (!kind) return false;
            if (matches(element, '[data-message-author-role], user-query, model-response')) return false;
            if (element.closest('pre, code, code-block, table')) return false;
            if (element.querySelector('pre, code-block, table, user-query, model-response')) return false;
            // Image attachment cards need to keep their actual media node so it
            // can be embedded. Plain file cards are collapsed below.
            if (element.querySelector('img, canvas, video, audio')) return false;

            const text = normalizeWhitespace(getText(element));
            const label = cardLabel(element);
            return Boolean(label || text) && text.length <= 240;
        }));

        cards.forEach(card => {
            const kind = cardSignal(card);
            const label = cardLabel(card);
            const text = label ? `[${kind}: ${label}]` : `[${kind}]`;
            const href = cardHref(card);
            const replacement = format === 'markdown' ?
                (href ? `[${escapeMarkdownLinkText(text.slice(1, -1))}](${escapeMarkdownUrl(href)})` : text) :
                addReplacement(replacements, href ?
                    `<a class="card-placeholder" href="${sanitizeHtml(href)}">${sanitizeHtml(text)}</a>` :
                    `<span class="card-placeholder">${sanitizeHtml(text)}</span>`);
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
            // Text nodes generated by earlier processing stages (code fences,
            // tables, display math, placeholders, protected blocks) carry
            // intentional layout and must pass through untouched.
            if (value.includes('```') || value.includes('| ---') || value.includes('$$') || value.includes(MARKER_PREFIX) || value.match(/^\s*\[[^\]]+\]/)) {
                return value;
            }
            return value.replace(/[ \t\r\n]+/g, ' ');
        }

        if (node.nodeType !== 1) return '';

        const tag = node.tagName.toLowerCase();
        if (['script', 'style', 'button', 'svg'].includes(tag)) return '';
        if (tag === 'br') return '\n';

        // User prompts render inside white-space: pre-wrap containers where
        // every line break and indent is author input; extract them verbatim
        // instead of collapsing whitespace (issue #25). Protected behind a
        // marker so markdown cleanup cannot re-flow the preserved text.
        if (tag !== 'code' && tag !== 'pre' && isPreWrapElement(node)) {
            const text = preWrapText(node);
            if (!text.trim()) return '';
            const preserved = context.replacements ? addReplacement(context.replacements, text) : text;
            return `\n\n${preserved}\n\n`;
        }

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
                index
            })).join('')}\n`;
        }

        if (tag === 'li') {
            const marker = context.listType === 'ol' ? `${(context.index || 0) + 1}. ` : '- ';
            const content = serializeMarkdownChildren(node, context).trim();
            // Nested structures are indented once per level here; the marker
            // width keeps continuation lines aligned for ordered lists too.
            const continuation = ' '.repeat(marker.length);
            return content ? `${marker}${content.replace(/\n+/g, `\n${continuation}`)}\n` : '';
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
            // Backslash escapes are not processed inside markdown code spans,
            // so the content must stay verbatim; doubling backslashes turned
            // `\n` into `\\n` (issue #25). Backtick collisions are handled the
            // CommonMark way: a longer delimiter plus space padding.
            const content = getCodeText(node).trim();
            if (!content) return '';

            const backtickRuns = content.match(/`+/g) || [];
            const longestRun = backtickRuns.reduce((max, run) => Math.max(max, run.length), 0);
            const delimiter = '`'.repeat(longestRun + 1);
            const pad = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
            return `${delimiter}${pad}${content}${pad}${delimiter}`;
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

    // ChatGPT web-search citations carry a utm_source=chatgpt.com tracking
    // parameter and/or live inside citation-marked wrappers. Ordinary links in
    // conversation text match neither signal, so they stay inline-only.
    function isCitationLink(link, href) {
        if (/[?&]utm_source=chatgpt\.com/i.test(href)) return true;
        return Boolean(link.closest?.('[class*="citation"], [data-testid*="citation"], [data-test-id*="citation"], [data-testid*="sources"], [data-test-id*="sources"]'));
    }

    function citationLabel(link, href) {
        const label = normalizeWhitespace(
            link.getAttribute?.('aria-label') ||
            link.getAttribute?.('title') ||
            link.textContent ||
            ''
        );
        // Numeric pills ("1", "2") and empty labels read poorly in a reference
        // list; fall back to the source hostname instead.
        if (label && !/^\[?\d{1,3}\]?$/.test(label)) return label;

        try {
            return new URL(href).hostname.replace(/^www\./, '') || href;
        } catch (error) {
            return href;
        }
    }

    // Collected before UI stripping and link flattening so citation pills that
    // render as buttons or inside removable chrome are still seen (issue #27).
    function collectCitations(clone) {
        const citations = [];
        const seenHrefs = new Set();

        queryAll(clone, 'a[href]').forEach(link => {
            const href = String(link.href || link.getAttribute('href') || '').trim();
            if (isUnsafeHref(href) || !isCitationLink(link, href)) return;
            if (seenHrefs.has(href)) return;
            seenHrefs.add(href);
            citations.push({ href, label: citationLabel(link, href) });
        });

        return citations;
    }

    function renderReferences(citations, format) {
        if (!citations.length) return '';

        if (format === 'markdown') {
            const lines = citations.map((citation, index) =>
                `${index + 1}. [${escapeMarkdownLinkText(citation.label)}](${escapeMarkdownUrl(citation.href)})`);
            return `\n\n**References:**\n\n${lines.join('\n')}`;
        }

        const items = citations.map(citation =>
            `<li><a href="${sanitizeHtml(citation.href)}">${sanitizeHtml(citation.label)}</a></li>`).join('');
        return `\n<div class="references"><strong>References:</strong><ol>${items}</ol></div>`;
    }

    function serializeMessageContent(element, format, options = {}) {
        const clone = element.cloneNode(true);
        const replacements = [];

        annotatePreWrapElements(element, clone);
        annotateMediaSources(element, clone);
        const citations = collectCitations(clone);
        // Cards implemented as buttons disappear with the rest of the UI if
        // they are not converted first (issue #32).
        processCards(clone, format, replacements);
        removeUiElements(clone);
        if (options.stripMessageMetadata) {
            queryAll(clone, MESSAGE_TIMESTAMP_SELECTOR).forEach(element => element.remove());
        }
        processCodeBlocks(clone, format, replacements);
        processMath(clone);
        processMedia(clone, format, replacements);
        processLinks(clone, format, replacements);
        processTables(clone, format, replacements);

        if (format === 'markdown') {
            if (isPreWrapElement(clone)) {
                return preWrapText(clone).trim();
            }

            const markdown = cleanMarkdown(serializeMarkdownChildren(clone, { replacements }));
            return (restoreReplacements(markdown, replacements) + renderReferences(citations, format)).trim();
        }

        const html = serializeHtmlChildren(clone, replacements)
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return restoreReplacements(html, replacements) + renderReferences(citations, format);
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
        const richCount = richContentCount(element);
        return normalizeWhitespace(element.textContent).length + richCount * 200;
    }

    function richContentCount(element) {
        const structured = queryAll(element, 'pre, code-block, table, img, canvas, video, audio, annotation, script[type^="math/tex"]').length;
        const cards = Array.from(element?.querySelectorAll?.('*') || []).filter(candidate => Boolean(cardSignal(candidate))).length;
        return structured + cards;
    }

    function isValidMessage(element, provider) {
        // Our own progress UI is in the page while the sweep runs. It lives
        // outside the conversation container and carries no message markers, so
        // it should never match — this is belt and braces, because a UI element
        // captured as a message would end up in the reader's export.
        if (element?.closest?.('[data-chat-exporter-ui]')) return false;

        const scope = messageScope(element, provider);
        const text = normalizeWhitespace(scope?.textContent);
        const richCount = richContentCount(scope);

        if (text.length < 5 && richCount === 0) return false;
        if (text.length > 200000) return false;
        if (matches(element, 'nav, aside, header, footer, form, menu')) return false;
        if (element.querySelector('textarea, input[type="text"], [contenteditable="true"]') && !element.hasAttribute('data-message-author-role')) return false;
        if (getClassName(element).match(/\b(typing|loading|spinner)\b/i)) return false;

        return true;
    }

    function findMessages(doc, provider) {
        for (const selector of provider.messageSelectors) {
            const messages = topLevelElements(queryAll(doc, selector)).filter(element => isValidMessage(element, provider));
            if (messages.length > 0) {
                console.log(`[Chat Exporter] ${provider.id}: using selector "${selector}" (${messages.length} messages)`);
                return messages;
            }
        }

        const container = doc.querySelector('[role="main"], main, [class*="conversation"], [class*="chat"]');
        if (!container) return [];

        return topLevelElements(queryAll(container, ':scope > article, :scope > section, :scope > div')).filter(element => isValidMessage(element, provider));
    }

    // The selector that currently matches at least one real message, or null.
    function resolveMessageSelector(doc, provider) {
        for (const selector of provider.messageSelectors) {
            if (topLevelElements(queryAll(doc, selector)).some(element => isValidMessage(element, provider))) return selector;
        }
        return null;
    }

    // Every element the message selector matches, including turns the provider
    // has mounted but not filled in yet — isValidMessage hides those, and a
    // sweep needs to know they exist so it can wait for them. The selector is
    // passed in because a screenful can be entirely mid-mount, and rediscovering
    // it from that snapshot would find nothing at all.
    function findMessageCandidates(doc, selector) {
        return selector ? topLevelElements(queryAll(doc, selector)) : [];
    }

    function selectContentRoot(messageElement, provider) {
        const scope = messageScope(messageElement, provider);
        const roots = Array.from(new Set([messageElement, scope].filter(Boolean)));
        const candidates = [...roots];

        provider.contentSelectors.forEach(selector => {
            roots.forEach(root => {
                if (matches(root, selector)) candidates.push(root);
                candidates.push(...queryAll(root, selector));
            });
        });

        return Array.from(new Set(candidates))
            .filter(Boolean)
            .sort((a, b) => meaningfulScore(b) - meaningfulScore(a))[0] || messageElement;
    }

    function identifySender(element, index, provider) {
        const tag = element.tagName.toLowerCase();
        if (tag === 'user-query') return { sender: 'You', reliable: true };
        if (tag === 'model-response') return { sender: provider.assistantName, reliable: true };

        const roleCarrier = matches(element, '[data-message-author-role], [data-author], [data-sender]') ?
            element : element.querySelector?.('[data-message-author-role], [data-author], [data-sender]');
        const role = roleCarrier?.getAttribute('data-message-author-role') || roleCarrier?.getAttribute('data-author') || roleCarrier?.getAttribute('data-sender');
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

    // Dedupe key for a serialized message. This has to cover the whole message:
    // a prefix would collapse two different turns that open the same way — a
    // conversation full of redrafts of one letter does exactly that, and the
    // loser silently vanishes from the export.
    function contentHash(content) {
        const text = normalizeWhitespace(String(content || '').replace(/<[^>]+>/g, ' '));
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return `${text.length}:${hash.toString(36)}`;
    }

    function captureMessage(state, messageElement, provider, format) {
        const contentRoot = selectContentRoot(messageElement, provider);
        const content = serializeMessageContent(contentRoot, format, { stripMessageMetadata: true });
        const minLength = richContentCount(contentRoot) > 0 ? 3 : 10;

        // Not captured — the caller must be free to try this element again once
        // the provider has filled it in.
        if (!content || normalizeWhitespace(content).length < minLength) return false;

        const hash = contentHash(content);
        if (state.seen.has(hash)) return true;
        state.seen.add(hash);

        const index = state.messages.length;
        const sender = identifySender(messageElement, index, provider);
        const timestamp = extractMessageTimestamp(messageElement, provider);
        const messageId = providerMessageId(messageElement, provider);
        const message = {
            sender: sender.sender,
            senderType: sender.sender === 'You' ? 'user' : 'assistant',
            reliableSender: sender.reliable,
            content,
            index,
            order: conversationOffset(messageElement, state.container, provider)
        };
        if (messageId) message.providerMessageId = messageId;
        if (timestamp) Object.assign(message, timestamp);
        state.messages.push(message);
        state.lines = (state.lines || 0) + String(content).split('\n').length;
        return true;
    }

    // Where a message sits in the whole conversation, not in the viewport: the
    // sweep visits messages in whatever order the virtualizer mounts them, so
    // capture order is not conversation order.
    function conversationOffset(element, container, provider) {
        const rect = messageScope(element, provider)?.getBoundingClientRect?.();
        if (!rect) return 0;
        const scrolled = container ? container.scrollTop : (getWindow(element.ownerDocument)?.scrollY || 0);
        return rect.top + scrolled;
    }

    // A capture that starts at the top can still see turns the virtualizer left
    // mounted from the previous scroll position, which lands them in the export
    // ahead of the turns that actually precede them.
    function sortByConversationOrder(messages, provider) {
        messages.sort((a, b) => a.order - b.order || a.index - b.index);
        messages.forEach((message, index) => {
            message.index = index;
            delete message.order;

            // Providers without role markers fall back to alternating senders,
            // which was decided in capture order — redo it in reading order.
            const previous = messages[index - 1];
            if (message.reliableSender || !previous) return;
            const flipped = previous.senderType === 'user';
            message.sender = flipped ? provider.assistantName : 'You';
            message.senderType = flipped ? 'assistant' : 'user';
        });
        return messages;
    }

    function buildConversation(doc, provider, options, messages) {
        return {
            version: ENGINE_VERSION,
            provider: provider.id,
            providerLabel: provider.assistantName,
            sourceLabel: provider.sourceLabel,
            title: extractConversationTitle(doc, provider),
            sourceUrl: options.includeSourceUrl === true ? doc.defaultView?.location?.href || '' : '',
            date: formatDate(options.date || new Date()),
            messages
        };
    }

    function chatGptConversationId(doc) {
        try {
            const url = new URL(doc.defaultView?.location?.href || '');
            const match = url.pathname.match(/(?:^|\/)c\/([^/]+)/);
            return match ? decodeURIComponent(match[1]) : '';
        } catch (error) {
            return '';
        }
    }

    // ChatGPT wraps its inline citation markers in private-use code points:
    // U+E200 "cite" U+E202 "turn1search0" U+E201. They are invisible machinery,
    // not text — rendering payload markdown without removing them puts
    // "citeturn1search0" in the middle of a sentence.
    const PAYLOAD_CITATION_MARKER = /\uE200[\s\S]*?\uE201/g;
    const PAYLOAD_PRIVATE_USE = /[\uE200-\uE20F]/g;

    function stripPayloadMarkers(value) {
        return String(value ?? '').replace(PAYLOAD_CITATION_MARKER, '').replace(PAYLOAD_PRIVATE_USE, '');
    }

    function hostnameOf(href) {
        try {
            return new URL(href).hostname.replace(/^www\./, '');
        } catch (error) {
            return '';
        }
    }

    // metadata.content_references carries the real title and URL of each source
    // — strictly better than the DOM, where the same citation renders as a pill
    // labelled "W3C+1".
    function payloadCitations(message) {
        const references = message?.metadata?.content_references;
        if (!Array.isArray(references)) return [];

        const seen = new Set();
        const citations = [];
        references.forEach(reference => {
            (Array.isArray(reference?.items) ? reference.items : []).forEach(item => {
                const href = String(item?.url || '').trim();
                if (!href || seen.has(href) || isUnsafeHref(href)) return;
                seen.add(href);
                citations.push({
                    href,
                    label: normalizeWhitespace(item?.title) || hostnameOf(href) || href
                });
            });
        });
        return citations;
    }

    // Each marker is replaced in place by the source it points at, so a citation
    // reads as a link rather than vanishing.
    function resolvePayloadCitations(text, message, format) {
        const references = message?.metadata?.content_references;
        let result = String(text ?? '');

        if (Array.isArray(references)) {
            references.forEach(reference => {
                const marker = reference?.matched_text;
                if (!marker || !result.includes(marker)) return;

                const item = (Array.isArray(reference.items) ? reference.items : [])
                    .find(candidate => candidate?.url && !isUnsafeHref(String(candidate.url)));
                if (!item) {
                    result = result.split(marker).join('');
                    return;
                }

                const href = String(item.url);
                const label = normalizeWhitespace(item.title) || hostnameOf(href) || href;
                const link = format === 'markdown'
                    ? ` ([${escapeMarkdownLinkText(label)}](${escapeMarkdownUrl(href)}))`
                    : ` (<a href="${sanitizeHtml(href)}">${sanitizeHtml(label)}</a>)`;
                result = result.split(marker).join(link);
            });
        }

        return stripPayloadMarkers(result);
    }

    function payloadContentText(content) {
        if (!content || !Array.isArray(content.parts)) return '';
        return content.parts.map(part => {
            if (typeof part === 'string') return part;
            if (!part || typeof part !== 'object') return '';
            if (typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
            // A multimodal part is an asset pointer with no text of its own.
            // Returning '' for it is why an image-only turn rendered empty and
            // was dropped entirely; its media is added by the caller from
            // payloadAttachmentDescriptors.
            return '';
        }).filter(Boolean).join('\n\n').trim();
    }

    function activePayloadMessages(payload) {
        const mapping = payload?.mapping;
        if (!mapping || typeof mapping !== 'object') return [];

        const entries = [];
        const visited = new Set();
        let nodeId = typeof payload.current_node === 'string' ? payload.current_node : '';
        while (nodeId && !visited.has(nodeId)) {
            const node = mapping[nodeId];
            if (!node) break;
            visited.add(nodeId);
            entries.push({ nodeId, node, message: node.message });
            nodeId = typeof node.parent === 'string' ? node.parent : '';
        }

        if (entries.length > 0) return entries.reverse().filter(entry => entry.message);

        return Object.entries(mapping)
            .map(([id, node]) => ({ nodeId: id, node, message: node?.message }))
            .filter(entry => entry.message)
            .sort((left, right) => Number(left.message.create_time || 0) - Number(right.message.create_time || 0));
    }

    // Regenerating an answer, or editing a prompt, leaves the previous version
    // in the mapping as a sibling branch. activePayloadMessages walks only the
    // branch currently on screen, so those older versions are invisible to the
    // export — they are part of the conversation's history but not its current
    // reading. Off by default because including them silently would change
    // every existing user's file; `includeVariants: true` opts in.
    function payloadVariantMessages(payload, activeEntries) {
        const mapping = payload?.mapping;
        if (!mapping || typeof mapping !== 'object') return [];

        const onActiveChain = new Set(activeEntries.map(entry => entry.nodeId));
        const variants = [];

        activeEntries.forEach(entry => {
            const parentId = entry.node?.parent;
            const siblings = parentId ? (mapping[parentId]?.children || []) : [];
            siblings.forEach(siblingId => {
                if (onActiveChain.has(siblingId)) return;
                // Each discarded branch can itself be several turns deep.
                const stack = [siblingId];
                const seen = new Set();
                while (stack.length > 0) {
                    const nodeId = stack.pop();
                    if (seen.has(nodeId) || onActiveChain.has(nodeId)) continue;
                    seen.add(nodeId);
                    const node = mapping[nodeId];
                    if (!node) continue;
                    if (node.message) {
                        variants.push({ nodeId, node, message: node.message, supersededBy: entry });
                    }
                    (node.children || []).forEach(child => stack.push(child));
                }
            });
        });

        return variants.filter(entry => isMainPayloadMessage(entry));
    }

    function isMainPayloadMessage(entry) {
        const message = entry?.message;
        const role = message?.author?.role;
        if (role !== 'user' && role !== 'assistant') return false;
        if (message.metadata?.is_visually_hidden_from_conversation) return false;

        const contentType = String(message.content?.content_type || '').toLowerCase();
        return !['thoughts', 'reasoning_recap', 'code', 'execution_output', 'tool_result'].includes(contentType);
    }

    function payloadMessageMatches(conversation, entries) {
        const mainEntries = entries.filter(isMainPayloadMessage);
        const byId = new Map(mainEntries.map(entry => [String(entry.message.id || entry.nodeId), entry]));
        const used = new Set();
        const matches = new Map();
        const positionalFallbackIsSafe = mainEntries.length === conversation.messages.length;

        conversation.messages.forEach(message => {
            let entry = message.providerMessageId ? byId.get(String(message.providerMessageId)) : null;
            if (entry && used.has(entry)) entry = null;

            if (!entry && positionalFallbackIsSafe) {
                entry = mainEntries.find(candidate => {
                    if (used.has(candidate)) return false;
                    const role = candidate.message.author?.role;
                    return role === message.senderType;
                }) || null;
            }

            if (!entry) return;
            used.add(entry);
            matches.set(message, entry);
        });

        return matches;
    }

    function payloadReasoningRecaps(entries) {
        const recaps = new Map();
        let pending = [];

        entries.forEach(entry => {
            const message = entry.message;
            const role = message?.author?.role;
            const contentType = String(message?.content?.content_type || '').toLowerCase();

            if (role === 'assistant' && contentType === 'reasoning_recap') {
                const text = payloadContentText(message.content);
                if (text) pending.push(text);
                return;
            }

            if (role === 'user') {
                pending = [];
                return;
            }

            if (role === 'assistant' && isMainPayloadMessage(entry) && pending.length > 0) {
                recaps.set(String(message.id || entry.nodeId), pending.join('\n\n'));
                pending = [];
            }
        });

        return recaps;
    }

    function payloadAttachmentDescriptors(message) {
        const descriptors = new Map();
        const add = descriptor => {
            if (!descriptor) return;
            const key = descriptor.sandboxPath || descriptor.fileId || descriptor.name;
            if (!key) return;
            const existing = descriptors.get(key);
            if (existing) {
                Object.entries(descriptor).forEach(([field, value]) => {
                    if (!existing[field] && value) existing[field] = value;
                });
                return;
            }
            descriptors.set(key, descriptor);
        };

        (Array.isArray(message?.metadata?.attachments) ? message.metadata.attachments : []).forEach(attachment => {
            const fileId = attachment?.id || attachment?.file_id || '';
            const mimeType = String(attachment?.mime_type || attachment?.content_type || '');
            add({
                kind: /^image\//i.test(mimeType) ? 'image' : 'file',
                fileId: String(fileId || ''),
                name: String(attachment?.name || attachment?.filename || fileId || ''),
                mimeType
            });
        });

        (Array.isArray(message?.content?.parts) ? message.content.parts : []).forEach(part => {
            if (!part || typeof part !== 'object') return;
            const pointer = String(part.asset_pointer || part.file_id || '');
            const fileId = String(part.file_id || pointer.match(/file-[a-z0-9_-]+/i)?.[0] || '');
            const mimeType = String(part.mime_type || part.content_type || part.metadata?.mime_type || '');
            const isImage = /^image\//i.test(mimeType) || /image/i.test(String(part.content_type || ''));
            add({
                kind: isImage ? 'image' : 'file',
                fileId,
                name: String(part.name || part.filename || part.metadata?.name || fileId || ''),
                mimeType: /^image\//i.test(mimeType) ? mimeType : (isImage ? 'image/png' : mimeType)
            });
        });

        const sandboxPattern = /sandbox:(\/mnt\/data\/[^\s)\]"'<>]+)/g;
        for (const match of payloadContentText(message?.content).matchAll(sandboxPattern)) {
            const sandboxPath = match[1].replace(/[.,;:!?*`]+$/, '');
            const name = sandboxPath.split('/').filter(Boolean).pop() || 'Generated file';
            add({ kind: 'sandbox', sandboxPath, name });
        }

        return Array.from(descriptors.values());
    }

    async function fetchWithTimeout(doc, input, init = {}, timeout = METADATA_FETCH_TIMEOUT) {
        const win = getWindow(doc);
        const fetcher = win?.fetch?.bind(win);
        if (typeof fetcher !== 'function') return null;

        const AbortControllerCtor = win?.AbortController || globalThis.AbortController;
        const controller = typeof AbortControllerCtor === 'function' ? new AbortControllerCtor() : null;
        const setTimer = win?.setTimeout?.bind(win) || setTimeout;
        const clearTimer = win?.clearTimeout?.bind(win) || clearTimeout;
        const timer = controller ? setTimer(() => controller.abort(), timeout) : null;

        try {
            return await fetcher(input, {
                credentials: 'include',
                cache: 'no-store',
                ...init,
                ...(controller ? { signal: controller.signal } : {})
            });
        } catch (error) {
            return null;
        } finally {
            if (timer !== null) clearTimer(timer);
        }
    }

    function metadataRequestTimeout(doc, options) {
        const configured = options.metadataFetchTimeout ?? METADATA_FETCH_TIMEOUT;
        if (!options.metadataDeadline) return configured;
        return Math.max(0, Math.min(configured, options.metadataDeadline - now(getWindow(doc))));
    }

    async function readJsonBody(response) {
        if (!response) return null;
        try {
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    // Cookies alone are not enough for chatgpt.com's private API: a cookie-only
    // read of a conversation the reader owns comes back as 404
    // "conversation_inaccessible" — the same status a deleted conversation
    // returns. Waiting for a 401 that never arrives meant the bearer-token
    // retry never fired, so every export silently lost its metadata and left a
    // red 404 in the console. The token is fetched up front instead, once per
    // export, and reused for every private-API call in the pass.
    function createChatGptAuth(options = {}) {
        return {
            token: typeof options.accessToken === 'string' ? options.accessToken : '',
            accountId: typeof options.accountId === 'string' ? options.accountId : '',
            sessionRead: false,
            signedOut: false,
            accountIds: null
        };
    }

    function chatGptAuthHeaders(auth) {
        const headers = {};
        if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
        // A workspace member acts as an account, not as themselves. Without
        // this the backend scopes the lookup to their personal account and
        // reports the workspace's own conversation as missing.
        if (auth?.accountId) headers['ChatGPT-Account-Id'] = auth.accountId;
        return headers;
    }

    async function readChatGptToken(doc, options, refresh = false) {
        const auth = options.chatGptAuth;
        if (!auth) return '';
        if (!refresh && (auth.token || auth.sessionRead)) return auth.token;

        const timeout = metadataRequestTimeout(doc, options);
        if (timeout <= 0) return auth.token;

        auth.sessionRead = true;
        const response = await fetchWithTimeout(doc, CHATGPT_SESSION_ENDPOINT, {}, timeout);
        // An unreachable session endpoint means "unknown", not "signed out" —
        // a cookie-only attempt is still worth making in that case.
        if (!response?.ok) return auth.token;

        const session = await readJsonBody(response);
        const token = typeof session?.accessToken === 'string' ? session.accessToken : '';
        auth.signedOut = !token;
        if (token) auth.token = token;
        return auth.token;
    }

    async function readChatGptAccountIds(doc, options) {
        const auth = options.chatGptAuth;
        if (!auth) return [];
        if (auth.accountIds) return auth.accountIds;
        auth.accountIds = [];

        const timeout = metadataRequestTimeout(doc, options);
        if (timeout <= 0) return auth.accountIds;

        const response = await fetchWithTimeout(doc, CHATGPT_ACCOUNTS_ENDPOINT, {
            headers: chatGptAuthHeaders({ token: auth.token })
        }, timeout);
        if (!response?.ok) return auth.accountIds;

        const payload = await readJsonBody(response);
        const accounts = payload?.accounts && typeof payload.accounts === 'object' ? payload.accounts : {};
        const ids = new Set();
        Object.values(accounts).forEach(entry => {
            const accountId = entry?.account?.account_id;
            if (typeof accountId === 'string' && accountId) ids.add(accountId);
        });
        auth.accountIds = Array.from(ids);
        return auth.accountIds;
    }

    function isChatGptAuthFailure(response, body) {
        if (!response) return false;
        if (response.status === 401 || response.status === 403) return true;
        if (response.status !== 404) return false;

        const detail = body?.detail;
        const code = String(detail?.code || body?.error_code || '').toLowerCase();
        if (CHATGPT_AUTH_ERROR_CODES.has(code)) return true;

        const message = String(typeof detail === 'string' ? detail : detail?.message || body?.message || '');
        return /log ?in|sign ?in|unauthori[sz]ed|not authenticated/i.test(message);
    }

    async function attemptChatGptJson(doc, options, endpoint) {
        const timeout = metadataRequestTimeout(doc, options);
        if (timeout <= 0) return { reason: 'timeout' };

        const response = await fetchWithTimeout(doc, endpoint, {
            headers: chatGptAuthHeaders(options.chatGptAuth)
        }, timeout);
        if (!response) return { reason: 'network' };

        const body = await readJsonBody(response);
        if (response.ok) return { reason: 'ok', body };
        if (isChatGptAuthFailure(response, body)) return { reason: 'auth' };
        return { reason: `status:${response.status}` };
    }

    // Escalates only as far as it has to: the token already in hand, then a
    // fresh one in case the session rolled over mid-export, then each workspace
    // the reader belongs to.
    async function fetchChatGptJson(doc, options, endpoint) {
        // Callers reaching this without a pass-scoped auth state get one rather
        // than a TypeError; the state is what makes a single token serve every
        // request in the export.
        const auth = options.chatGptAuth || (options.chatGptAuth = createChatGptAuth(options));
        await readChatGptToken(doc, options);
        // No session means the request can only 404. Skipping it keeps a
        // confusing error out of the reader's console.
        if (auth.signedOut && !auth.token) return { reason: 'signed-out' };

        let result = await attemptChatGptJson(doc, options, endpoint);
        if (result.reason !== 'auth') return result;

        const stale = auth.token;
        const refreshed = await readChatGptToken(doc, options, true);
        if (refreshed && refreshed !== stale) {
            result = await attemptChatGptJson(doc, options, endpoint);
            if (result.reason !== 'auth') return result;
        }

        for (const accountId of await readChatGptAccountIds(doc, options)) {
            if (accountId === auth.accountId) continue;
            auth.accountId = accountId;
            result = await attemptChatGptJson(doc, options, endpoint);
            if (result.reason !== 'auth') return result;
        }

        // Leaving the last losing account id in place would misdirect every
        // later request in this pass.
        auth.accountId = '';
        return result;
    }

    function chatGptMetadataNote(reason) {
        if (reason === 'signed-out') {
            return 'this tab has no signed-in ChatGPT session';
        }
        if (reason === 'auth') {
            return 'ChatGPT would not authorize the request for this conversation';
        }
        if (reason === 'timeout' || reason === 'network') {
            return 'the request to ChatGPT did not complete in time';
        }
        return `ChatGPT answered ${String(reason).replace(/^status:/, 'HTTP ')} — a temporary chat, a shared link or a deleted conversation has no stored copy to read`;
    }

    async function fetchChatGptPayload(doc, options) {
        if (options.chatGptMetadata === false) return null;
        const conversationId = chatGptConversationId(doc);
        if (!conversationId) return null;

        const endpoint = `/backend-api/conversation/${encodeURIComponent(conversationId)}`;
        const result = await fetchChatGptJson(doc, options, endpoint);
        if (result.reason === 'ok') return result.body;

        // This pass only adds timestamps, attachment names and reasoning
        // recaps; the conversation itself is already captured from the DOM. A
        // bare 404 in the console reads like a broken exporter, so name the
        // cause and say the export is fine.
        console.info(`[Chat Exporter] Per-message metadata was skipped: ${chatGptMetadataNote(result.reason)}. The conversation itself exported normally.`);
        return null;
    }

    function imageMimeType(value) {
        const mime = String(value || '').split(';')[0].trim().toLowerCase();
        return /^image\/(?:png|jpe?g|gif|webp|avif|bmp)$/.test(mime) ? mime : '';
    }

    function bytesToDataUrl(bytes, mimeType, doc) {
        const win = getWindow(doc);
        const encode = win?.btoa?.bind(win) || (typeof btoa === 'function' ? btoa : null);
        if (!encode) return '';

        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return `data:${mimeType};base64,${encode(binary)}`;
    }

    function isSameOrigin(doc, url) {
        const location = getWindow(doc)?.location;
        if (!location?.href) return false;
        try {
            return new URL(url, location.href).origin === location.origin;
        } catch (error) {
            return false;
        }
    }

    async function fetchEmbeddedImage(doc, descriptor, options) {
        if (!descriptor.fileId) return null;
        let timeout = metadataRequestTimeout(doc, options);
        if (timeout <= 0) return null;
        const maxBytes = options.maxEmbeddedImageBytes ?? MAX_EMBEDDED_IMAGE_BYTES;
        const endpoint = `/backend-api/files/download/${encodeURIComponent(descriptor.fileId)}?inline=true`;
        // The same private API behind the same session: without the bearer
        // token this hands back the signed-out shape rather than the file.
        let response = await fetchWithTimeout(doc, endpoint, {
            headers: chatGptAuthHeaders(options.chatGptAuth)
        }, timeout);
        if (!response?.ok) return null;

        let contentType = String(response.headers?.get?.('content-type') || '');
        if (/application\/json/i.test(contentType)) {
            const metadata = await readJsonBody(response);
            // This endpoint reports failure as HTTP 200 with an error envelope,
            // so response.ok says nothing about whether a file came back.
            if (metadata?.status === 'error') return null;
            const downloadUrl = metadata?.download_url || metadata?.downloadUrl || metadata?.url;
            if (!downloadUrl) return null;

            // The link points at a signed CDN URL. Sending the bearer token
            // there would hand the reader's ChatGPT credentials to a
            // third-party host, so only a same-origin hop stays authenticated.
            const sameOrigin = isSameOrigin(doc, downloadUrl);
            timeout = metadataRequestTimeout(doc, options);
            if (timeout <= 0) return null;
            response = await fetchWithTimeout(doc, downloadUrl, sameOrigin
                ? { credentials: 'include', headers: chatGptAuthHeaders(options.chatGptAuth) }
                : { credentials: 'omit' }, timeout);
            if (!response?.ok) return null;
            contentType = String(response.headers?.get?.('content-type') || '');
        }

        const mimeType = imageMimeType(contentType) || imageMimeType(descriptor.mimeType);
        if (!mimeType) return null;
        const declaredSize = Number(response.headers?.get?.('content-length') || 0);
        if (declaredSize > maxBytes) return null;

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) return null;
        const dataUrl = bytesToDataUrl(bytes, mimeType, doc);
        return dataUrl ? { dataUrl, size: bytes.byteLength } : null;
    }

    // Renders a payload message the DOM never showed us. Its parts are the
    // markdown the model actually produced, which is exactly what a markdown
    // export wants; HTML exports escape it and keep the paragraph breaks.
    function payloadMessageToExport(entry, assistantName, format, doc, options = {}) {
        const message = entry.message;
        const text = resolvePayloadCitations(payloadContentText(message.content), message, format);
        // No text is not the same as no message: an image-only turn carries its
        // content in attachments, which the caller appends.
        const allowEmpty = options.allowEmpty === true;
        if (!text && !allowEmpty) return null;

        const isUser = message.author?.role === 'user';
        const content = !text ? '' : (format === 'markdown'
            ? text
            : text.split(/\n{2,}/).map(block => `<p>${sanitizeHtml(block).replace(/\n/g, '<br>')}</p>`).join(''));

        const exported = {
            sender: isUser ? 'You' : assistantName,
            senderType: isUser ? 'user' : 'assistant',
            reliableSender: true,
            source: 'payload',
            // Retained for one release so anything reading the old flag keeps
            // working; `source` is the field to use.
            recovered: true,
            content
        };

        // The payload carries create_time, so a recovered message has no reason
        // to be the only one in the file without a timestamp.
        const iso = timestampIso(message.create_time);
        if (iso) {
            exported.timestampIso = iso;
            exported.timestamp = formatMessageTimestamp(iso, doc);
        }
        return exported;
    }

    // Inserts recovered messages at their true position without reordering what
    // the DOM gave us: each one lands after the last captured message that
    // precedes it in the conversation. Recovery is skipped entirely when no
    // captured message could be matched to the payload, because then there is
    // no anchor to place anything against.
    function alignWithPayload(conversation, mainEntries, matches, format, seenMessageIds, doc) {
        const indexOfEntry = new Map(mainEntries.map((entry, index) => [entry, index]));
        const positionOf = new Map();
        matches.forEach((entry, message) => {
            if (indexOfEntry.has(entry)) positionOf.set(message, indexOfEntry.get(entry));
        });
        if (positionOf.size === 0) return { recovered: 0, reordered: 0 };

        const missing = mainEntries.filter(entry =>
            !seenMessageIds.has(String(entry.message.id || entry.nodeId)));

        let recovered = 0;
        missing.forEach(entry => {
            const message = payloadMessageToExport(entry, conversation.providerLabel, format, doc);
            if (!message) return;

            const target = indexOfEntry.get(entry);
            let insertAt = conversation.messages.length;
            for (let index = 0; index < conversation.messages.length; index++) {
                const position = positionOf.get(conversation.messages[index]);
                if (position !== undefined && position > target) {
                    insertAt = index;
                    break;
                }
            }
            conversation.messages.splice(insertAt, 0, message);
            positionOf.set(message, target);
            recovered++;
        });

        // The sweep orders messages by scroll offset, measured at whatever
        // moment each one was captured. A virtualizer that changes heights
        // between those moments can make two neighbours compare wrongly — a
        // real export came out with an answer ahead of the question that
        // prompted it. The payload chain is the conversation's actual order, so
        // where it covers every message, it decides.
        let reordered = 0;
        const everyMessagePlaced = conversation.messages.every(message => positionOf.has(message));
        if (everyMessagePlaced) {
            const before = conversation.messages.slice();
            conversation.messages.sort((left, right) => positionOf.get(left) - positionOf.get(right));
            reordered = conversation.messages.reduce(
                (count, message, index) => count + (before[index] === message ? 0 : 1), 0);
        }

        conversation.messages.forEach((message, index) => { message.index = index; });
        return { recovered, reordered };
    }

    function appendPayloadVariants(conversation, payload, entries, matches, format, doc) {
        const variants = payloadVariantMessages(payload, entries);
        if (variants.length === 0) return 0;

        const positionOfEntry = new Map();
        matches.forEach((entry, message) => positionOfEntry.set(entry, message));

        let added = 0;
        variants.forEach(variant => {
            const message = payloadMessageToExport(variant, conversation.providerLabel, format, doc);
            if (!message) return;

            message.variant = true;
            message.recovered = false;
            const note = 'Earlier version (replaced by a regeneration or edit)';
            message.content = format === 'markdown'
                ? `*${note}*\n\n${message.content}`
                : `<p><em>${sanitizeHtml(note)}</em></p>${message.content}`;

            // Sit next to the turn that replaced this one where we can find it,
            // otherwise at the end rather than at an arbitrary position.
            const superseding = positionOfEntry.get(variant.supersededBy);
            const at = superseding ? conversation.messages.indexOf(superseding) : -1;
            if (at >= 0) {
                conversation.messages.splice(at + 1, 0, message);
            } else {
                conversation.messages.push(message);
            }
            added++;
        });

        conversation.messages.forEach((message, index) => { message.index = index; });
        return added;
    }

    function appendMessageEnrichment(message, markdown, html, needle) {
        if (needle && message.content.includes(needle)) return;
        message.content = `${message.content}${message.content ? '\n\n' : ''}${markdown !== null ? markdown : html}`.trim();
    }

    // ─── Payload-first rendering ────────────────────────────────────────────
    // The payload is the markdown the model produced; the DOM is a rendering of
    // it. Reading the source directly avoids every artifact that comes from
    // scraping a rendering — screen-reader labels, escaped citation chips,
    // duplicated formulas — and needs no scroll sweep at all, so a long
    // conversation costs one request instead of a minute of scrolling.
    //
    // Markdown only, deliberately: HTML and PDF need rendered HTML, which the
    // DOM already provides natively and which the payload would require a
    // markdown parser to produce.
    async function renderConversationFromPayload(payload, doc, provider, options) {
        const format = 'markdown';
        const entries = activePayloadMessages(payload);
        const mainEntries = entries.filter(isMainPayloadMessage);
        if (mainEntries.length === 0) return null;

        const recaps = payloadReasoningRecaps(entries);
        const messages = [];
        let embeddedBytes = 0;
        const totalImageBudget = options.maxTotalEmbeddedImageBytes ?? MAX_TOTAL_EMBEDDED_IMAGE_BYTES;

        for (const entry of mainEntries) {
            const message = payloadMessageToExport(entry, provider.assistantName, format, doc, { allowEmpty: true });
            if (!message) continue;

            for (const descriptor of payloadAttachmentDescriptors(entry.message)) {
                const name = descriptor.name || (descriptor.kind === 'image' ? 'Image attachment' : 'File attachment');

                if (descriptor.kind === 'sandbox') {
                    const href = `sandbox:${descriptor.sandboxPath}`;
                    appendMessageEnrichment(message, `[File: ${escapeMarkdownLinkText(name)}](${escapeMarkdownUrl(href)})`, null, descriptor.sandboxPath);
                    continue;
                }
                if (descriptor.kind !== 'image') {
                    appendMessageEnrichment(message, `[File: ${name}]`, null, name);
                    continue;
                }

                let embedded = null;
                if (metadataRequestTimeout(doc, options) > 0 && embeddedBytes < totalImageBudget) {
                    embedded = await fetchEmbeddedImage(doc, descriptor, options);
                }
                if (embedded && embeddedBytes + embedded.size <= totalImageBudget) {
                    embeddedBytes += embedded.size;
                    appendMessageEnrichment(message, `![${escapeMarkdownLinkText(name)}](${embedded.dataUrl})`, null, name);
                } else {
                    appendMessageEnrichment(message, `[Image: ${name}]`, null, name);
                }
            }

            const recap = recaps.get(String(entry.message.id || entry.nodeId));
            if (recap && !message.content.includes(recap)) {
                appendMessageEnrichment(message, `**Reasoning:** ${recap}`, null, recap);
            }

            const citations = payloadCitations(entry.message);
            if (citations.length > 0) {
                message.content = `${message.content}${renderReferences(citations, format)}`.trim();
            }

            // A turn with neither text nor media has nothing to export.
            if (!normalizeWhitespace(message.content)) continue;
            message.index = messages.length;
            messages.push(message);
        }

        if (messages.length === 0) return null;

        const conversation = buildConversation(doc, provider, options, messages);
        conversation.source = 'payload';
        conversation.expectedMessages = mainEntries.length;
        conversation.unreachedMessages = 0;
        conversation.missedMessages = 0;
        conversation.recoveredMessages = 0;
        // Complete by construction: the payload is the conversation, not a
        // sample of whatever happened to be on screen.
        conversation.complete = true;
        conversation.metadataStatus = 'enriched';

        if (options.includeVariants === true) {
            const matches = new Map();
            mainEntries.forEach((entry, index) => {
                if (messages[index]) matches.set(messages[index], entry);
            });
            conversation.variantMessages = appendPayloadVariants(conversation, payload, entries, matches, format, doc);
        } else {
            const available = payloadVariantMessages(payload, entries).length;
            conversation.variantMessages = 0;
            conversation.availableVariants = available;
            if (available > 0) {
                console.info(`[Chat Exporter] This conversation has ${available} earlier version(s) of regenerated or edited turns. They are not in the export; pass includeVariants: true to include them.`);
            }
        }

        return conversation;
    }

    async function enrichChatGptConversation(conversation, doc, format, options) {
        if (conversation.provider !== 'chatgpt') return conversation;

        const started = now(getWindow(doc));
        const ownDeadline = started + (options.metadataMaxDuration ?? METADATA_MAX_DURATION);
        const metadataDeadline = options.metadataDeadline ? Math.min(options.metadataDeadline, ownDeadline) : ownDeadline;
        // One auth state for the whole pass: the conversation read discovers
        // the working token and account, and every file download reuses them.
        const enrichmentOptions = {
            ...options,
            metadataDeadline,
            chatGptAuth: options.chatGptAuth || createChatGptAuth(options)
        };
        // The payload-first path may already have fetched (or failed to fetch)
        // this. Asking twice costs a second request and a second round of
        // console noise for the same answer.
        const payload = 'chatGptPayload' in options
            ? options.chatGptPayload
            : await fetchChatGptPayload(doc, enrichmentOptions);
        if (!payload) {
            conversation.metadataStatus = 'unavailable';
            return conversation;
        }

        const entries = activePayloadMessages(payload);
        const matches = payloadMessageMatches(conversation, entries);
        const recaps = payloadReasoningRecaps(entries);
        let embeddedBytes = 0;

        // The payload is ground truth for how many messages the conversation
        // has. Comparing *ids the sweep actually encountered* — not counts —
        // keeps deliberate content dedupe (two identical "ok" turns collapse by
        // design) from reading as a missing message.
        const mainEntries = entries.filter(isMainPayloadMessage);
        conversation.expectedMessages = mainEntries.length;
        if (options.seenMessageIds instanceof Set) {
            conversation.unreachedMessages = mainEntries.filter(entry =>
                !options.seenMessageIds.has(String(entry.message.id || entry.nodeId))).length;
        }

        // A virtualizer can end a sweep anywhere, and a message the sweep never
        // reached is simply absent from the DOM — there is nothing left to
        // re-read. The payload holds its text, so rather than report a hole,
        // fill it. The DOM stays the source for everything it did capture,
        // because it carries formatting the payload's raw parts do not.
        // Alternate versions the reader replaced. Appended after the message
        // that superseded them, clearly labelled, so the conversation still
        // reads in order.
        if (options.includeVariants === true) {
            conversation.variantMessages = appendPayloadVariants(conversation, payload, entries, matches, format, doc);
            if (conversation.variantMessages > 0) {
                console.log(`[Chat Exporter] ${conversation.variantMessages} earlier version(s) of edited or regenerated turns were included.`);
            }
        } else {
            const available = payloadVariantMessages(payload, entries).length;
            conversation.variantMessages = 0;
            conversation.availableVariants = available;
            if (available > 0) {
                console.info(`[Chat Exporter] This conversation has ${available} earlier version(s) of regenerated or edited turns. They are not in the export; pass includeVariants: true to include them.`);
            }
        }

        // Only messages the sweep never laid eyes on. A message that *was*
        // encountered and then collapsed by content dedupe was collapsed on
        // purpose; re-adding it here would undo that decision.
        if (options.recoverMissing !== false && options.seenMessageIds instanceof Set) {
            const aligned = alignWithPayload(
                conversation, mainEntries, matches, format, options.seenMessageIds, doc);
            conversation.recoveredMessages = aligned.recovered;
            if (aligned.recovered > 0) {
                conversation.unreachedMessages = Math.max(0, (conversation.unreachedMessages || 0) - aligned.recovered);
                console.log(`[Chat Exporter] ${aligned.recovered} message(s) the scroll sweep could not reach were recovered from ChatGPT's own record of this conversation.`);
            }
            if (aligned.reordered > 0) {
                console.log(`[Chat Exporter] ${aligned.reordered} message(s) were put back into conversation order using ChatGPT's own record.`);
            }
        }

        for (const [message, entry] of matches.entries()) {
            const nativeMessage = entry.message;
            if (!message.timestamp) {
                const iso = timestampIso(nativeMessage.create_time);
                if (iso) {
                    message.timestampIso = iso;
                    message.timestamp = formatMessageTimestamp(iso, doc);
                }
            }

            const descriptors = payloadAttachmentDescriptors(nativeMessage);
            if (descriptors.length > 0) message.attachments = descriptors;

            for (const descriptor of descriptors) {
                const name = descriptor.name || (descriptor.kind === 'image' ? 'Image attachment' : 'File attachment');

                if (descriptor.kind === 'image') {
                    let embedded = null;
                    if (metadataRequestTimeout(doc, enrichmentOptions) > 0 && embeddedBytes < (options.maxTotalEmbeddedImageBytes ?? MAX_TOTAL_EMBEDDED_IMAGE_BYTES)) {
                        embedded = await fetchEmbeddedImage(doc, descriptor, enrichmentOptions);
                    }
                    if (embedded && embeddedBytes + embedded.size <= (options.maxTotalEmbeddedImageBytes ?? MAX_TOTAL_EMBEDDED_IMAGE_BYTES)) {
                        embeddedBytes += embedded.size;
                        const markdown = `![${escapeMarkdownLinkText(name)}](${embedded.dataUrl})`;
                        const html = `<figure class="embedded-image"><img class="exported-media" src="${sanitizeHtml(embedded.dataUrl)}" alt="${sanitizeHtml(name)}"><figcaption>${sanitizeHtml(name)}</figcaption></figure>`;
                        appendMessageEnrichment(message, format === 'markdown' ? markdown : null, html, name);
                    } else {
                        const label = `[Image: ${name}]`;
                        const html = `<span class="media-placeholder">${sanitizeHtml(label)}</span>`;
                        appendMessageEnrichment(message, format === 'markdown' ? label : null, html, name);
                    }
                    continue;
                }

                if (descriptor.kind === 'sandbox') {
                    const href = `sandbox:${descriptor.sandboxPath}`;
                    const markdown = `[File: ${escapeMarkdownLinkText(name)}](${escapeMarkdownUrl(href)})`;
                    const html = `<a class="card-placeholder" href="${sanitizeHtml(href)}">${sanitizeHtml(`[File: ${name}]`)}</a>`;
                    appendMessageEnrichment(message, format === 'markdown' ? markdown : null, html, descriptor.sandboxPath);
                    continue;
                }

                const label = `[File: ${name}]`;
                const html = `<span class="card-placeholder">${sanitizeHtml(label)}</span>`;
                appendMessageEnrichment(message, format === 'markdown' ? label : null, html, name);
            }

            const nativeId = String(nativeMessage.id || entry.nodeId);
            const recap = recaps.get(nativeId);
            if (recap && !message.content.includes(recap)) {
                const markdown = `**Reasoning:** ${recap}`;
                const html = `<div class="reasoning-recap"><strong>Reasoning:</strong> ${sanitizeHtml(recap).replace(/\n/g, '<br>')}</div>`;
                appendMessageEnrichment(message, format === 'markdown' ? markdown : null, html, recap);
            }
        }

        conversation.metadataStatus = 'enriched';
        return conversation;
    }

    function extractConversation(options = {}) {
        const doc = resolveDocument(options.document);
        const provider = providerFor(options.provider, doc);
        const format = options.format || 'markdown';
        const state = { seen: new Set(), messages: [], container: null };

        findMessages(doc, provider).forEach(messageElement => captureMessage(state, messageElement, provider, format));

        // A single pass reads the DOM in document order already; drop the
        // ordering key so the message shape stays the same.
        state.messages.forEach(message => {
            delete message.order;
            delete message.providerMessageId;
        });

        return buildConversation(doc, provider, options, state.messages);
    }

    // ─── Virtualized (lazy-loaded) conversations ─────────────────────────────
    // ChatGPT windows long conversations: messages scrolled out of view are
    // removed from the DOM entirely, so a single findMessages pass exports only
    // the visible fragment (issues #28, #29). The async path below sweeps the
    // scroll container from top to bottom, capturing and serializing each
    // message while its DOM nodes exist.

    function findScrollContainer(doc, provider) {
        const win = getWindow(doc);
        const probe = findMessages(doc, provider)[0];
        let node = probe ? probe.parentElement : null;

        while (node && node !== doc.body && node !== doc.documentElement) {
            if (node.scrollHeight > node.clientHeight + 10) {
                let overflowY = '';
                try {
                    overflowY = win?.getComputedStyle?.(node)?.overflowY || '';
                } catch (error) {
                    // Fall through: a scrollable-looking node is still usable.
                }
                if (!overflowY || /(auto|scroll|overlay)/.test(overflowY)) return node;
            }
            node = node.parentElement;
        }

        const root = doc.scrollingElement || doc.documentElement;
        return root && root.scrollHeight > root.clientHeight + 10 ? root : null;
    }

    // Wait for the provider to finish mounting whatever the scroll revealed,
    // instead of sleeping a fixed guess. Resolves as soon as the container has
    // been quiet for `quiet` ms, and never waits longer than the old fixed
    // delay — so this can only be faster, never less thorough. Falls back to
    // the plain sleep where MutationObserver is unavailable.
    function awaitRenderSettled(doc, container, maxWait, quiet) {
        const win = getWindow(doc);
        const setTimer = win?.setTimeout?.bind(win) || setTimeout;
        const clearTimer = win?.clearTimeout?.bind(win) || clearTimeout;
        const ObserverCtor = win?.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);

        if (typeof ObserverCtor !== 'function' || !container || typeof container.isConnected !== 'boolean') {
            return new Promise(resolve => setTimer(resolve, maxWait));
        }

        return new Promise(resolve => {
            let quietTimer = null;
            let settled = false;
            const observer = new ObserverCtor(() => {
                clearTimer(quietTimer);
                quietTimer = setTimer(finish, quiet);
            });

            function finish() {
                if (settled) return;
                settled = true;
                clearTimer(quietTimer);
                clearTimer(ceiling);
                try {
                    observer.disconnect();
                } catch (error) {
                    // Already gone; nothing to release.
                }
                resolve();
            }

            const ceiling = setTimer(finish, maxWait);
            try {
                observer.observe(container, { childList: true, subtree: true, characterData: true });
            } catch (error) {
                finish();
                return;
            }
            // Nothing mounting at all still costs one quiet interval, not a
            // full delay.
            quietTimer = setTimer(finish, quiet);
        });
    }

    // An answer still being written would be exported half-finished. Rather
    // than hunt for a "stop generating" button — a test id that changes with
    // every redesign — watch whether the newest message is still growing.
    async function awaitStreamingSettled(doc, provider, wait, outOfTime) {
        const sample = () => {
            const messages = findMessages(doc, provider);
            const last = messages[messages.length - 1];
            return last ? normalizeWhitespace(last.textContent).length : 0;
        };

        let previous = sample();
        await wait(STREAM_SETTLE_INTERVAL);
        if (sample() === previous) return true;

        console.log('[Chat Exporter] The answer is still being written — waiting for it to finish before exporting.');
        let stable = 0;
        while (stable < 2 && !outOfTime()) {
            previous = sample();
            await wait(STREAM_SETTLE_INTERVAL);
            stable = sample() === previous ? stable + 1 : 0;
        }
        return stable >= 2;
    }

    // Stable identity across scroll snapshots. Message ids are the reliable
    // signal; text prefix plus length covers providers without ids. Streaming
    // partials that slip through are still collapsed by contentHash dedupe.
    function messageKey(element, provider) {
        const id = providerMessageId(element, provider);
        if (id) return `id:${id}`;

        const scope = messageScope(element, provider);
        const testId = scope?.getAttribute?.('data-testid') || scope?.getAttribute?.('data-test-id') || '';
        const text = normalizeWhitespace(scope?.textContent);
        return `text:${testId}:${text.length}:${text.slice(0, 200)}`;
    }

    // Markdown from ChatGPT reads the payload first; everything else, and every
    // failure, falls through to the DOM sweep below unchanged.
    function canUsePayloadSource(doc, provider, format, options) {
        if (options.sourceFromPayload === false) return false;
        if (options.chatGptMetadata === false) return false;
        if (provider.id !== 'chatgpt') return false;
        if (format !== 'markdown') return false;
        // A shared link or temporary chat has no stored conversation to read.
        return Boolean(chatGptConversationId(doc));
    }

    async function extractConversationFull(options = {}) {
        const doc = resolveDocument(options.document);
        const provider = providerFor(options.provider, doc);
        const format = options.format || 'markdown';

        if (canUsePayloadSource(doc, provider, format, options)) {
            const emit = event => {
                if (typeof options.onProgress !== 'function') return;
                try {
                    options.onProgress(event);
                } catch (error) {
                    // A progress listener must never cost the reader an export.
                }
            };
            try {
                emit({ phase: 'start', provider: provider.id, messages: 0, lines: 0 });
                emit({ phase: 'payload', messages: 0, lines: 0, percent: 10 });

                const win = getWindow(doc);
                const payloadOptions = {
                    ...options,
                    metadataDeadline: now(win) + (options.metadataMaxDuration ?? METADATA_MAX_DURATION),
                    chatGptAuth: options.chatGptAuth || createChatGptAuth(options)
                };
                const payload = await fetchChatGptPayload(doc, payloadOptions);
                if (payload) {
                    emit({ phase: 'rendering', messages: 0, lines: 0, percent: 40 });
                    const conversation = await renderConversationFromPayload(payload, doc, provider, payloadOptions);
                    if (conversation) {
                        const lines = conversation.messages.reduce(
                            (total, message) => total + String(message.content).split('\n').length, 0);
                        const last = conversation.messages[conversation.messages.length - 1];
                        emit({
                            phase: 'done',
                            percent: 100,
                            messages: conversation.messages.length,
                            lines,
                            complete: true,
                            expectedMessages: conversation.expectedMessages || 0,
                            unreachedMessages: 0,
                            recoveredMessages: 0,
                            lastSender: last ? last.sender : '',
                            lastPreview: last ? normalizeWhitespace(last.content).slice(0, 90) : ''
                        });
                        console.log(`[Chat Exporter] Read ${conversation.messages.length} messages from ChatGPT's own record — no scrolling needed.`);
                        return conversation;
                    }
                }
                // Remember what we learned so the DOM path does not re-ask.
                options = { ...options, chatGptPayload: payload || null, chatGptAuth: payloadOptions.chatGptAuth };
                console.info('[Chat Exporter] Falling back to reading the page, which requires scrolling the whole conversation.');
            } catch (error) {
                // Any failure here is a reason to read the page instead, never a
                // reason to fail the export.
                console.warn('[Chat Exporter] Could not read the stored conversation; reading the page instead.', error);
            }
        }
        const scrollDelay = options.scrollDelay ?? 350;
        const renderQuiet = options.renderQuiet ?? RENDER_QUIET_INTERVAL;
        const maxScrollSteps = options.maxScrollSteps ?? 400;
        const win = getWindow(doc);
        const wait = ms => new Promise(resolve => (win?.setTimeout || setTimeout)(resolve, ms));

        const container = options.scroll === false ? null : findScrollContainer(doc, provider);

        // A callback, never a DOM node: the engine is used headless in tests and
        // must not grow a dependency on a document it can draw into. A listener
        // that throws is the listener's problem, never the export's.
        const emitProgress = event => {
            if (typeof options.onProgress !== 'function') return;
            try {
                options.onProgress(event);
            } catch (error) {
                // A broken progress UI must not cost the reader their export.
            }
        };

        const state = { seen: new Set(), messages: [], container, lines: 0 };
        const seenKeys = new Set();
        // Every message id the sweep encountered, whether or not it was
        // captured or deduped — the evidence for "did we actually get there".
        const seenMessageIds = new Set();
        // Turns that were on screen but had nothing to serialize yet. They are
        // the reason for the return pass below.
        const pendingKeys = new Set();
        let messageSelector = null;
        const capture = () => {
            messageSelector = messageSelector || resolveMessageSelector(doc, provider);
            findMessageCandidates(doc, messageSelector).forEach(messageElement => {
                const encounteredId = providerMessageId(messageElement, provider);
                if (encounteredId) seenMessageIds.add(encounteredId);
                const key = messageKey(messageElement, provider);
                if (seenKeys.has(key)) return;
                // A virtualizer mounts the turn before it fills in the text, so
                // a message seen empty must stay eligible for a later pass —
                // marking it seen here would drop it from the export for good.
                if (isValidMessage(messageElement, provider) && captureMessage(state, messageElement, provider, format)) {
                    seenKeys.add(key);
                    pendingKeys.delete(key);
                    return;
                }
                pendingKeys.add(key);
            });
        };

        // An export must not be able to hang the page: every phase runs against
        // one wall-clock budget, however slow the provider is.
        // Extended, not consumed, while the tab is hidden — see awaitVisible.
        let deadline = now(win) + (options.maxDuration ?? DEFAULT_MAX_DURATION);
        const outOfTime = () => now(win) >= deadline;
        let hiddenBudget = options.maxHiddenWait ?? MAX_HIDDEN_WAIT;

        // A hidden tab gets its timers throttled and its off-screen rendering
        // suspended, so the sweep crawls and the provider may never mount the
        // turns being scrolled to. Waiting beats exporting a fragment.
        // Waiting for the reader used to be charged to the export's own clock:
        // a backgrounded tab burned the whole maxDuration doing nothing, said
        // so once, and then saved whatever happened to be mounted. The wait now
        // draws on its own budget and gives the time back, so raising
        // maxDuration no longer just buys a longer stall.
        const awaitVisible = async () => {
            if (!doc.hidden) return true;
            if (hiddenBudget <= 0) return false;

            console.warn('[Chat Exporter] This tab is in the background — bring it to the front to continue. The export clock is paused while it waits.');
            emitProgress(describe('hidden'));
            const startedHidden = now(win);
            while (doc.hidden && now(win) - startedHidden < hiddenBudget) {
                await wait(200);
            }

            const waited = now(win) - startedHidden;
            hiddenBudget -= waited;
            // Time spent waiting on a person is not time spent exporting.
            deadline += waited;

            if (doc.hidden) {
                console.warn(`[Chat Exporter] Still in the background after ${Math.round(waited / 1000)}s — exporting only what is currently on the page.`);
                return false;
            }
            console.log('[Chat Exporter] Tab is back in front — resuming the sweep.');
            emitProgress(describe('resumed'));
            return true;
        };

        // Minutes of silence during a long sweep are indistinguishable from a
        // hang, which is how a working export gets abandoned.
        let lastProgress = now(win);
        const reportProgress = scroller => {
            if (now(win) - lastProgress < PROGRESS_INTERVAL) return;
            lastProgress = now(win);
            const travel = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
            const percent = Math.min(99, Math.max(0, Math.round((scroller.scrollTop / travel) * 100)));
            console.log(`[Chat Exporter] Sweeping… ${percent}% · ${state.messages.length} messages captured so far.`);
        };

        // Wait for the newest answer to stop growing before anything is read,
        // whether or not there is a container to sweep.
        const describe = phase => {
            const last = state.messages[state.messages.length - 1];
            return {
                phase,
                messages: state.messages.length,
                lines: state.lines || 0,
                lastSender: last ? last.sender : '',
                lastPreview: last ? normalizeWhitespace(String(last.content).replace(/<[^>]+>/g, ' ')).slice(0, 90) : ''
            };
        };

        emitProgress({ ...describe('start'), provider: provider.id });

        if (options.awaitStreaming !== false) emitProgress(describe('streaming'));
        const settled = options.awaitStreaming === false
            ? true
            : await awaitStreamingSettled(doc, provider, wait, outOfTime);

        if (container) {
            const originalTop = container.scrollTop;
            let scroller = container;

            try {
                await awaitVisible();

                // Pin to the top until the container stops growing so providers
                // that lazily prepend older history finish loading it. Two stable
                // rounds, because a virtualizer can pause between batches.
                let previousHeight = -1;
                let stableHeights = 0;
                let guard = 0;
                while (stableHeights < 2 && guard++ < maxScrollSteps && !outOfTime()) {
                    scroller.scrollTop = 0;
                    // Deliberately the full delay, not the mutation-driven
                    // settle: this loop waits on a *network* fetch of older
                    // history, which produces no DOM mutation until it lands.
                    // Settling on quiet here would declare "no more history"
                    // after 60ms and start the sweep below the real top. It
                    // runs a handful of times, so it is not worth the risk.
                    await wait(scrollDelay);
                    stableHeights = scroller.scrollHeight === previousHeight ? stableHeights + 1 : 0;
                    previousHeight = scroller.scrollHeight;
                }

                capture();

                // Sweep down in overlapping steps, capturing whatever the
                // virtualizer renders at each stop. Progress is judged by messages
                // captured and by reaching the bottom — never by scrollTop alone,
                // because swapping rendered turns for shorter placeholders can drag
                // scrollTop backwards mid-sweep and would end the sweep early,
                // exporting only the fragment captured so far.
                let stalls = 0;
                guard = 0;
                while (guard++ < maxScrollSteps && !outOfTime()) {
                    await awaitVisible();

                    // Client-side navigation can swap the whole thread out from
                    // under us; writes to a detached node go nowhere.
                    if (scroller.isConnected === false) {
                        const replacement = findScrollContainer(doc, provider);
                        if (!replacement) break;
                        scroller = replacement;
                        state.container = replacement;
                    }

                    const beforeTop = scroller.scrollTop;
                    const beforeCount = state.messages.length;
                    scroller.scrollTop = beforeTop + Math.max(scroller.clientHeight * 0.75, 200);
                    await awaitRenderSettled(doc, scroller, scrollDelay, renderQuiet);
                    capture();

                    // Turns mount before their text renders. Give the ones that were
                    // not ready a moment and look again here, while they are still on
                    // screen — once the sweep moves on they are gone, and providers
                    // that snap back to the newest message make a return trip
                    // impossible.
                    if (pendingKeys.size > 0 && !outOfTime()) {
                        await awaitRenderSettled(doc, scroller, scrollDelay, renderQuiet);
                        capture();
                    }

                    reportProgress(scroller);
                    {
                        const travel = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
                        emitProgress({
                            ...describe('sweep'),
                            percent: Math.min(99, Math.max(0, Math.round((scroller.scrollTop / travel) * 100)))
                        });
                    }

                    if (scroller.scrollTop > beforeTop || state.messages.length > beforeCount) {
                        stalls = 0;
                        continue;
                    }
                    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - BOTTOM_TOLERANCE) break;
                    if (++stalls >= MAX_SCROLL_STALLS) break;
                }

                // However the sweep ended — bottom reached, stalled, or out of
                // steps — finish at the bottom. A stall can end the loop
                // anywhere, and the final capture used to run at whatever
                // position that happened to be: a real conversation stalled at
                // 85% and shipped without its last two messages, which are
                // exactly the ones a reader notices are missing.
                if (!outOfTime()) {
                    scroller.scrollTop = scroller.scrollHeight;
                    await awaitRenderSettled(doc, scroller, scrollDelay, renderQuiet);
                    capture();
                    if (pendingKeys.size > 0 && !outOfTime()) {
                        await awaitRenderSettled(doc, scroller, scrollDelay, renderQuiet);
                    }
                }
                capture();
            } finally {
                // Whatever happened, the reader gets their scroll position back.
                try {
                    scroller.scrollTop = originalTop;
                } catch (error) {
                    // The container went away; nothing to restore.
                }
            }
        } else {
            capture();
        }

        const conversation = buildConversation(doc, provider, options, sortByConversationOrder(state.messages, provider));
        emitProgress({ ...describe('metadata'), percent: 100 });
        if (!outOfTime()) {
            try {
                await enrichChatGptConversation(conversation, doc, format, { ...options, metadataDeadline: deadline, seenMessageIds });
            } catch (error) {
                // Metadata is an enhancement over the DOM capture. A changed
                // private endpoint must never prevent the conversation export.
                console.warn('[Chat Exporter] Per-message metadata could not be added:', error);
            }
        }
        conversation.messages.forEach(message => {
            delete message.providerMessageId;
            if (!message.source) message.source = 'dom';
        });
        conversation.source = 'dom';

        // Turns that were on screen but never became readable. Saying so beats
        // handing over a short file that looks complete.
        conversation.missedMessages = pendingKeys.size;
        // An export can look clean and still be short: every turn the sweep saw
        // was captured, but the sweep never reached the top. Only the payload
        // can tell us that, and it is the difference between a heuristic and
        // proof.
        const unreached = conversation.unreachedMessages || 0;
        conversation.complete = pendingKeys.size === 0 && unreached === 0 && !outOfTime() && settled;
        if (unreached > 0) {
            console.warn(`[Chat Exporter] ${unreached} of ${conversation.expectedMessages} messages in this conversation were never reached by the scroll sweep. Raise maxDuration and keep the tab in the foreground.`);
        }
        if (!settled) {
            console.warn('[Chat Exporter] The answer was still being written when the export ran out of time; the last message may be cut off.');
        }
        emitProgress({
            ...describe('done'),
            percent: 100,
            complete: conversation.complete,
            expectedMessages: conversation.expectedMessages || 0,
            unreachedMessages: conversation.unreachedMessages || 0,
            recoveredMessages: conversation.recoveredMessages || 0
        });
        if (!conversation.complete) {
            console.warn(`[Chat Exporter] Export may be incomplete: ${conversation.messages.length} messages captured, ${pendingKeys.size} turn(s) never finished rendering${outOfTime() ? ', and the sweep ran out of time' : ''}. Keep the tab in the foreground and try again.`);
        }
        return conversation;
    }

    // The tab title, minus whatever the provider stamps on it.
    function documentTitleFor(doc, provider) {
        const rawTitle = String(doc.title || '');
        return normalizeWhitespace(
            provider.documentTitleSuffix ? rawTitle.replace(provider.documentTitleSuffix, '') : rawTitle
        );
    }

    // First selector in the cascade that yields a non-generic title, if any.
    function selectorTitleFor(doc, provider) {
        for (const selector of provider.titleSelectors) {
            const title = normalizeWhitespace(doc.querySelector(selector)?.textContent);
            if (title && !provider.genericTitlePattern.test(title)) return { selector, title };
        }
        return null;
    }

    function extractConversationTitle(doc, provider) {
        const docTitle = documentTitleFor(doc, provider);
        const usableDocTitle = docTitle && !provider.genericTitlePattern.test(docTitle) ? docTitle : '';

        // A guessed selector cannot outrank a tab title the provider is known to
        // keep accurate. Gemini's cascade matched its model picker and titled a
        // conversation "Flash-Lite"; the tab said what it actually was.
        if (provider.preferDocumentTitle && usableDocTitle) return usableDocTitle;

        const selectorTitle = selectorTitleFor(doc, provider);
        if (selectorTitle) return selectorTitle.title;

        return usableDocTitle || provider.defaultTitle;
    }

    // ─── Selector health check ───────────────────────────────────────────────
    // Provider markup drifts silently: an export keeps succeeding on a fallback
    // selector until one day nothing matches and the failure reaches a user as
    // "No messages found". Reading the real page is the only way to know, so
    // this reports what each selector in the shipped cascade actually matches.
    // It is generated into selector-doctor.js from this same source, which is
    // what stops the check itself from drifting away from the exporters.

    function describeSelector(doc, provider, selector) {
        const matched = topLevelElements(queryAll(doc, selector));
        const valid = matched.filter(element => isValidMessage(element, provider)).length;
        return { selector, matched: matched.length, valid };
    }

    async function probeChatGptApi(doc, options) {
        if (providerFor(options.provider, doc).id !== 'chatgpt') return null;
        const conversationId = chatGptConversationId(doc);
        if (!conversationId) return { conversationId: '', reason: 'no-conversation-id' };

        const probeOptions = {
            ...options,
            metadataDeadline: now(getWindow(doc)) + (options.metadataMaxDuration ?? METADATA_MAX_DURATION),
            chatGptAuth: createChatGptAuth(options)
        };
        const result = await fetchChatGptJson(
            doc,
            probeOptions,
            `/backend-api/conversation/${encodeURIComponent(conversationId)}`
        );
        return {
            conversationId,
            reason: result.reason,
            tokenObtained: Boolean(probeOptions.chatGptAuth.token),
            accountScoped: Boolean(probeOptions.chatGptAuth.accountId),
            payloadMessages: result.reason === 'ok'
                ? activePayloadMessages(result.body).filter(isMainPayloadMessage).length
                : 0
        };
    }

    // A long conversation can need more wall clock than the sweep is allowed,
    // and the only symptom is a short file with a warning after the fact. The
    // page itself says how far it has to scroll, so the cost is knowable up
    // front.
    function estimateSweep(container, options) {
        if (!container) return null;
        const scrollDelay = options.scrollDelay ?? 350;
        const renderQuiet = options.renderQuiet ?? RENDER_QUIET_INTERVAL;
        const budget = options.maxDuration ?? DEFAULT_MAX_DURATION;
        const step = Math.max(container.clientHeight * 0.75, 200);
        const steps = Math.ceil(Math.max(0, container.scrollHeight - container.clientHeight) / step);
        // A step costs one quiet interval when the provider renders promptly,
        // and is capped at scrollDelay when it does not — twice that for a step
        // whose turns mount late enough to need the second look.
        const bestMs = steps * renderQuiet;
        const worstMs = steps * scrollDelay * 2;
        return {
            steps,
            estimatedSeconds: Math.round(bestMs / 1000),
            worstCaseSeconds: Math.round(worstMs / 1000),
            budgetSeconds: Math.round(budget / 1000),
            // Judged on the typical cost with headroom, not the pathological
            // ceiling: a provider that never settles would blow any budget, and
            // warning about that on every long conversation is the same crying
            // wolf that got two other warnings demoted.
            fitsBudget: bestMs * 2 <= budget
        };
    }

    async function diagnose(options = {}) {
        const doc = resolveDocument(options.document);
        const provider = providerFor(options.provider, doc);
        const container = findScrollContainer(doc, provider);
        const messages = findMessages(doc, provider);

        const selectorTitle = selectorTitleFor(doc, provider);
        const documentTitle = documentTitleFor(doc, provider);
        const resolvedTitle = extractConversationTitle(doc, provider);

        const report = {
            version: ENGINE_VERSION,
            provider: provider.id,
            url: doc.defaultView?.location?.href || '',
            hidden: Boolean(doc.hidden),
            messageSelectors: provider.messageSelectors.map(selector => describeSelector(doc, provider, selector)),
            resolvedMessageSelector: resolveMessageSelector(doc, provider),
            contentSelectors: provider.contentSelectors.map(selector => ({
                selector,
                matched: queryAll(doc, selector).length
            })),
            turnSelector: {
                selector: provider.turnSelector,
                matched: queryAll(doc, provider.turnSelector).length
            },
            title: {
                resolvedBy: resolvedTitle === selectorTitle?.title ? selectorTitle.selector : 'document.title',
                value: resolvedTitle,
                documentTitle,
                rawDocumentTitle: normalizeWhitespace(doc.title),
                selectorCandidate: selectorTitle ? `${selectorTitle.selector} => "${selectorTitle.title}"` : null
            },
            scrollContainer: container
                ? `${container.tagName.toLowerCase()} (${container.scrollHeight}px in ${container.clientHeight}px)`
                : 'none — single-pass export',
            sweep: estimateSweep(container, options),
            messagesFound: messages.length,
            domTimestamps: queryAll(doc, MESSAGE_TIMESTAMP_SELECTOR).length
        };

        report.api = await probeChatGptApi(doc, options);

        // A cascade that only matches on its last entry still works, and is
        // exactly what a silent drift looks like one release before it breaks.
        const winner = report.messageSelectors.findIndex(entry => entry.valid > 0);
        report.warnings = [
            report.messagesFound === 0 ? 'No messages matched any selector — the exporter would fail on this page.' : '',
            winner > 0 ? `Falling back to selector #${winner + 1} of ${report.messageSelectors.length}; earlier entries no longer match.` : '',
            // Not a warning for a provider that prefers the tab on purpose —
            // crying wolf about designed behaviour is how real warnings get
            // ignored.
            !selectorTitle && !provider.preferDocumentTitle
                ? 'Every titleSelector missed; the title comes from the tab.' : '',
            // The failure that shipped in v0.9.4: a selector matched page chrome
            // (Gemini's model picker) and won over an accurate tab title.
            selectorTitle && documentTitle && selectorTitle.title !== documentTitle
                ? `A title selector matched "${selectorTitle.title}" but the tab says "${documentTitle}" — one of them is page chrome.`
                : '',
            report.api && report.api.reason !== 'ok' && report.api.reason !== 'no-conversation-id'
                ? `Per-message metadata is unavailable here (${report.api.reason}).` : '',
            report.hidden ? 'This tab is in the background; a real export would be throttled.' : '',
            report.sweep && !report.sweep.fitsBudget
                ? `This conversation needs about ${report.sweep.steps} scroll steps — ${report.sweep.estimatedSeconds}s at best, ${report.sweep.worstCaseSeconds}s if turns mount slowly — against a ${report.sweep.budgetSeconds}s budget. Export with a larger maxDuration, e.g. ChatExporterEngine.exportConversationFull({ provider: '${provider.id}', format: 'markdown', maxDuration: ${Math.max(120, Math.ceil(report.sweep.worstCaseSeconds * 1.5 / 30) * 30)}000 }).`
                : '',
        ].filter(Boolean);

        // Context, not problems. Mixing the two is how a warning list stops
        // being read at all.
        report.notes = [
            report.api?.reason === 'ok' && report.api.payloadMessages > report.messagesFound
                ? `The conversation has ${report.api.payloadMessages} messages; ${report.messagesFound} are in the page right now. A real export scrolls to reach the rest — this check does not.`
                : '',
            report.sweep && report.sweep.fitsBudget
                ? `About ${report.sweep.steps} scroll steps, ~${report.sweep.estimatedSeconds}s of a ${report.sweep.budgetSeconds}s budget.`
                : ''
        ].filter(Boolean);

        return report;
    }

    function renderMarkdown(conversation) {
        const source = conversation.sourceUrl
            ? `**Source:** [${conversation.sourceLabel}](${conversation.sourceUrl})\n`
            : `**Source:** ${conversation.sourceLabel}\n`;
        const lines = [
            `# ${conversation.title}\n`,
            `**Date:** ${conversation.date}`,
            source,
            '---\n'
        ];

        conversation.messages.forEach(message => {
            const timestamp = message.timestamp ? ` · ${message.timestamp}` : '';
            lines.push(`### **${message.sender}**${timestamp}\n`, message.content, '\n---\n');
        });

        return `${lines.join('\n').trim()}\n`;
    }

    function renderHtmlDocument(conversation, options = {}) {
        const isPdf = options.format === 'pdf';
        const source = sanitizeHtml(conversation.sourceUrl);
        const sourceMarkup = source
            ? `<a href="${source}">${sanitizeHtml(conversation.sourceLabel)}</a>`
            : sanitizeHtml(conversation.sourceLabel);
        const title = sanitizeHtml(conversation.title);
        const messages = conversation.messages.map(message => {
            const senderClass = message.senderType === 'user' ? 'user' : 'assistant';
            const timestamp = message.timestamp ?
                `<time${message.timestampIso ? ` datetime="${sanitizeHtml(message.timestampIso)}"` : ''}>${sanitizeHtml(message.timestamp)}</time>` : '';
            return `
        <div class="message ${senderClass}">
            <div class="sender"><span>${sanitizeHtml(message.sender)}</span>${timestamp}</div>
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
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 1rem;
        }
        .sender time {
            color: #667085;
            font-size: 0.8rem;
            font-weight: 400;
        }
        .content {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }
        .exported-media {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0.75rem 0;
            border-radius: 6px;
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
            <div><strong>Source:</strong> ${sourceMarkup}</div>
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

    // The conversation title has already been through the provider's cascade
    // and suffix cleanup; reading doc.title again here reintroduced whatever
    // the provider stamps on the tab.
    function filenameFor(conversation, format) {
        const safeTitle = normalizeWhitespace(conversation.title)
            .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '')
            .slice(0, 120)
            .replace(/[. ]+$/, '');

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

        // Revoking synchronously can abort the download in Firefox-based
        // browsers; give the browser a moment to grab the blob first.
        const revoke = () => urlApi.revokeObjectURL(url);
        if (typeof win?.setTimeout === 'function') {
            win.setTimeout(revoke, 2000);
        } else {
            revoke();
        }
    }

    function finishExport(doc, conversation, format, options) {
        if (conversation.messages.length === 0) {
            const message = 'No messages found. The page structure may have changed.';
            const win = getWindow(doc);
            if (typeof win?.alert === 'function') win.alert(message);
            console.warn(`[Chat Exporter] ${message}`);
            return { conversation, content: '' };
        }

        const content = render(conversation, format);
        const filename = options.filename || filenameFor(conversation, format);

        if (options.download !== false) {
            downloadFile(doc, content, filename, mimeFor(format));
            console.log(`[Chat Exporter] Exported ${conversation.messages.length} messages to ${filename}`);
        }

        // A short file that looks whole is worse than a warning: say so, once,
        // where the reader will see it.
        if (conversation.complete === false && options.notify !== false) {
            const win = getWindow(doc);
            const message = `Chat Exporter: this export may be incomplete — ${conversation.messages.length} messages captured` +
                (conversation.expectedMessages ? ` of ${conversation.expectedMessages} in the conversation` : '') +
                (conversation.missedMessages ? `, ${conversation.missedMessages} turn(s) never finished rendering` : '') +
                (conversation.unreachedMessages ? `, ${conversation.unreachedMessages} never reached by the scroll sweep` : '') +
                (conversation.recoveredMessages ? `, ${conversation.recoveredMessages} recovered from ChatGPT's record` : '') +
                '.\n\nKeep the ChatGPT tab in the foreground while exporting, then try again' +
                (conversation.unreachedMessages ? ' with a larger maxDuration' : '') + '.';
            if (typeof win?.alert === 'function') win.alert(message);
        }

        return { conversation, content, filename };
    }

    function exportConversation(options = {}) {
        const doc = resolveDocument(options.document);
        const format = options.format || 'markdown';
        const conversation = extractConversation({
            ...options,
            document: doc,
            format
        });

        return finishExport(doc, conversation, format, options);
    }

    async function exportConversationFull(options = {}) {
        const doc = resolveDocument(options.document);
        const format = options.format || 'markdown';
        const conversation = await extractConversationFull({
            ...options,
            document: doc,
            format
        });

        return finishExport(doc, conversation, format, options);
    }

    return {
        version: ENGINE_VERSION,
        providers: PROVIDERS,
        detectProvider,
        diagnose,
        extractConversation,
        extractConversationFull,
        exportConversation,
        exportConversationFull,
        serializers: {
            markdown: renderMarkdown,
            html: conversation => renderHtmlDocument(conversation, { format: 'html' }),
            pdf: conversation => renderHtmlDocument(conversation, { format: 'pdf' })
        },
        internals: {
            serializeMessageContent,
            extractCodeBlock,
            tableToMarkdown,
            tableToHtml,
            collectCitations,
            findScrollContainer,
            messageKey
        }
    };
});
