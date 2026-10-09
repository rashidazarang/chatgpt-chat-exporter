(function initChatExporterUi(root, factory) {
    const ui = factory();

    if (root) {
        root.ChatExporterUi = ui;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ui;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildChatExporterUi() {
    'use strict';

    const MENU_ID = 'chat-exporter-share-menu';
    const SHARE_BUTTON_ID = 'chat-exporter-share-button';
    const NATIVE_ITEM_ATTRIBUTE = 'data-chat-exporter-item';
    const INSTALL_FLAG = '__CHAT_EXPORTER_UI_INSTALLED__';

    // Milliseconds between share-control scans while the page mutates.
    const DEFAULT_SYNC_INTERVAL = 400;

    // Fixed geometry for renderIcon: [tag, attributes] per shape.
    const ICONS = {
        share: [
            ['circle', { cx: '18', cy: '5', r: '3' }],
            ['circle', { cx: '6', cy: '12', r: '3' }],
            ['circle', { cx: '18', cy: '19', r: '3' }],
            ['path', { d: 'm8.6 13.5 6.8 4M15.4 6.5l-6.8 4' }]
        ],
        link: [
            ['path', { d: 'M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1' }],
            ['path', { d: 'M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1' }]
        ],
        markdown: [
            ['path', { d: 'M4 6h16v12H4z' }],
            ['path', { d: 'M7 15V9l3 3 3-3v6' }],
            ['path', { d: 'm16 12 2 2 2-2' }]
        ],
        pdf: [
            ['path', { d: 'M6 2h9l5 5v15H6z' }],
            ['path', { d: 'M14 2v6h6' }],
            ['path', { d: 'M9 16h6M9 12h3' }]
        ]
    };

    function normalizeText(element) {
        return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element) {
        return Boolean(element && element.getClientRects().length);
    }

    // DOMParser is also a Trusted Types sink. Build our fixed SVG geometry
    // directly so strict policies need no parser, HTML string, or exception.
    function renderIcon(doc, shapes) {
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = doc.createElementNS(namespace, 'svg');
        const attributes = { width: '18', height: '18', viewBox: '0 0 24 24',
            fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true' };
        Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, value));
        shapes.forEach(([tag, attributes]) => {
            const shape = doc.createElementNS(namespace, tag);
            Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
            svg.appendChild(shape);
        });
        return svg;
    }

    function closeShareMenu(doc) {
        const menu = doc.getElementById(MENU_ID);
        const anchor = menu && doc.getElementById(menu.getAttribute('data-export-anchor'));
        if (anchor?.id === SHARE_BUTTON_ID) {
            anchor.setAttribute('aria-expanded', 'false');
            anchor.setAttribute('data-state', 'closed');
        }
        menu?.remove();
    }

    function createMenuItem(doc, label, icon, action) {
        const item = doc.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        item.style.cssText = [
            'display:flex', 'align-items:center', 'gap:10px', 'width:100%',
            'padding:10px 12px', 'border:0', 'border-radius:8px',
            'background:transparent', 'color:inherit', 'cursor:pointer',
            'font:inherit', 'font-size:14px', 'text-align:left'
        ].join(';');

        const glyph = renderIcon(doc, icon);
        if (glyph) item.appendChild(glyph);
        const text = doc.createElement('span');
        text.textContent = label;
        item.appendChild(text);

        item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--surface-hover, rgba(127,127,127,.14))';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
        item.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            action(item);
        });
        return item;
    }

    function openShareMenu(doc, anchor, actions, options = {}) {
        closeShareMenu(doc);

        const menu = doc.createElement('div');
        menu.id = MENU_ID;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Conversation export options');
        if (anchor.id) menu.setAttribute('data-export-anchor', anchor.id);
        menu.style.cssText = [
            'position:fixed', 'z-index:100000', 'min-width:210px', 'padding:6px',
            'border:1px solid var(--border-light, rgba(127,127,127,.22))',
            'border-radius:12px', 'background:var(--main-surface-primary, #fff)',
            'color:var(--text-primary, #111)',
            'box-shadow:0 12px 32px rgba(0,0,0,.22)',
            'font-family:ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ].join(';');

        // Only offer the native Share dialog when there is a real share control
        // to hand the click back to — accounts with sharing disabled have none.
        if (options.includeNativeShare) {
            menu.appendChild(createMenuItem(doc, 'Share…', ICONS.share, () => {
                closeShareMenu(doc);
                actions.openNativeShare();
            }));
        }

        // Temporary chats have no reusable conversation URL to copy.
        if (options.includeCopyLink !== false) menu.appendChild(
            createMenuItem(doc, 'Copy link', ICONS.link, async item => {
                try {
                    await actions.copyLink();
                    item.querySelector('span').textContent = 'Copied!';
                    doc.defaultView.setTimeout(() => closeShareMenu(doc), 650);
                } catch (error) {
                    console.error('[Chat Exporter] Could not copy the conversation link.', error);
                    item.querySelector('span').textContent = 'Copy failed';
                }
            })
        );
        menu.append(
            createMenuItem(doc, 'Export to Markdown', ICONS.markdown, () => {
                closeShareMenu(doc);
                actions.exportMarkdown();
            }),
            createMenuItem(doc, 'Export to PDF', ICONS.pdf, () => {
                closeShareMenu(doc);
                actions.exportPdf();
            })
        );

        doc.body.appendChild(menu);
        const anchorRect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const view = doc.defaultView;
        menu.style.top = `${Math.min(view.innerHeight - menuRect.height - 8, anchorRect.bottom + 8)}px`;
        menu.style.left = `${Math.max(8, Math.min(view.innerWidth - menuRect.width - 8, anchorRect.right - menuRect.width))}px`;
    }

    function replaceItemLabel(doc, item, label) {
        const walker = doc.createTreeWalker(item, doc.defaultView.NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            const trimmed = node.nodeValue.trim();
            if (!trimmed) continue;
            node.nodeValue = node.nodeValue.replace(trimmed, label);
            return true;
        }
        const text = doc.createElement('span');
        text.textContent = label;
        item.appendChild(text);
        return false;
    }

    function stripIdentity(item) {
        for (const attribute of ['data-state', 'id', 'aria-controls', 'aria-expanded', 'aria-haspopup', 'data-testid', 'data-test-id']) {
            item.removeAttribute(attribute);
        }
        // Nested ids and test ids would make ChatGPT's own queries pick up our
        // clone instead of the item it cloned from.
        item.querySelectorAll('[id], [data-testid], [data-test-id]').forEach(element => {
            element.removeAttribute('id');
            element.removeAttribute('data-testid');
            element.removeAttribute('data-test-id');
        });
    }

    // The cloned row keeps ChatGPT's own <svg> element — and its sizing and
    // colour classes — while carrying our glyph.
    function replaceItemIcon(doc, item, markup) {
        const target = item.querySelector('svg');
        const icon = renderIcon(doc, markup);
        if (!target || !icon) return false;

        while (target.firstChild) target.removeChild(target.firstChild);
        target.setAttribute('viewBox', icon.getAttribute('viewBox') || '0 0 24 24');
        target.setAttribute('fill', 'none');
        target.setAttribute('stroke', 'currentColor');
        target.setAttribute('stroke-width', '2');
        for (const child of Array.from(icon.childNodes)) {
            target.appendChild(child);
        }
        return true;
    }

    function cloneNativeItem(doc, template, label, format, action) {
        const item = template.cloneNode(true);
        item.setAttribute(NATIVE_ITEM_ATTRIBUTE, format);
        stripIdentity(item);
        replaceItemLabel(doc, item, label);
        replaceItemIcon(doc, item, format === 'pdf' ? ICONS.pdf : ICONS.markdown);
        item.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            action();
            doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true
            }));
        });
        return item;
    }

    function findMenus(root) {
        const selector = '[role="menu"], [data-radix-menu-content]';
        const menus = [];
        if (root.matches?.(selector)) menus.push(root);
        menus.push(...(root.querySelectorAll?.(selector) || []));
        return menus;
    }

    function testId(element) {
        return (element?.getAttribute?.('data-testid') || element?.getAttribute?.('data-test-id') || '').toLowerCase();
    }

    function isShareItem(item) {
        return testId(item).includes('share') || normalizeText(item) === 'Share';
    }

    // A Share entry marks a menu that acts on a whole conversation, so it is
    // what qualifies a menu for export items. Visibility is deliberately NOT
    // required: live ChatGPT ships the entry with `sm:hidden`, hiding it on wide
    // viewports where the header Share button takes over.
    function findShareItem(menu) {
        return Array.from(menu.querySelectorAll('button, [role="menuitem"], a, div'))
            .find(isShareItem) || null;
    }

    // Clone a row that actually renders — cloning the hidden Share entry would
    // inherit `sm:hidden` and produce export items nobody can see.
    function findCloneTemplate(menu, shareItem) {
        if (isVisible(shareItem)) return shareItem;
        const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).filter(isVisible);
        return items[0] || null;
    }

    // Sidebar rows open their own conversation menu, but an export always reads
    // the conversation that is currently open — so those menus are left alone
    // rather than offering to export someone else's chat.
    function isSidebarMenu(doc, menu) {
        const labelledBy = menu.getAttribute('aria-labelledby');
        const trigger = (labelledBy && doc.getElementById(labelledBy))
            || doc.querySelector('[aria-haspopup="menu"][aria-expanded="true"]');
        return Boolean(trigger?.closest('nav, aside, [role="navigation"]'));
    }

    function injectConversationMenuItems(doc, root, actions) {
        const menus = findMenus(root).filter(isVisible);
        for (const menu of menus) {
            if (menu.querySelector(`[${NATIVE_ITEM_ATTRIBUTE}]`)) continue;

            const shareItem = findShareItem(menu);
            if (!shareItem) continue;
            if (isSidebarMenu(doc, menu)) continue;

            const template = findCloneTemplate(menu, shareItem);
            if (!template) continue;

            const markdownItem = cloneNativeItem(
                doc,
                template,
                'Export to Markdown',
                'markdown',
                actions.exportMarkdown
            );
            const pdfItem = cloneNativeItem(
                doc,
                template,
                'Export to PDF',
                'pdf',
                actions.exportPdf
            );
            // Anchored to Share so exports keep their place in the list even
            // when Share itself is hidden.
            shareItem.insertAdjacentElement('afterend', pdfItem);
            shareItem.insertAdjacentElement('afterend', markdownItem);
        }
    }

    // Message turns carry their own share controls — live ChatGPT renders
    // `share-prompt-link-turn-action-button` inside
    // `section[data-testid="conversation-turn-N"]`, and the 2026 transcripts
    // put a "Share" / "Share prompt" action in every `li[data-message-role]`
    // and `[data-chatgpt-search-unit-key]`. Those share the current message,
    // not the conversation, and must keep their native behaviour.
    const TURN_CONTAINER = '[data-message-author-role], [data-message-role], [data-chatgpt-search-unit-key], [data-chatgpt-search-message-ids], [data-testid^="conversation-turn"], [data-testid^="conversation_turn"], article';

    // The data-testid hook works on every ChatGPT locale; the English text
    // match is a fallback for DOM revisions that drop the testid.
    function isHeaderShareButton(element) {
        const button = element?.closest?.('button, [role="button"]');
        if (!button) return null;
        if (button.closest('[role="menu"], [data-radix-menu-content]')) return null;
        if (button.closest(`#${MENU_ID}, #${SHARE_BUTTON_ID}`)) return null;
        if (button.closest('nav, aside, [role="navigation"]')) return null;
        if (button.closest(TURN_CONTAINER)) return null;

        if (testId(button).includes('share')) return button;
        return button.getAttribute('aria-label') === 'Share' || normalizeText(button) === 'Share' ? button : null;
    }

    function findHeaderShareButton(doc) {
        const candidates = doc.querySelectorAll('button, [role="button"]');
        for (const candidate of candidates) {
            const button = isHeaderShareButton(candidate);
            if (button && isVisible(button)) return button;
        }
        return null;
    }

    // Captured from ChatGPT's native Share button on 2026-10-08. Reuse the
    // page's stylesheet and SVG sprite, including hover, focus and theme rules.
    // This also works when the first page opened is a temporary chat, so there
    // has not yet been a real Share button to clone.
    const NATIVE_SHARE_CLASS = 'no-drag cursor-interaction items-center select-none disabled:cursor-default aria-disabled:cursor-default focus:outline-hidden disabled:opacity-40 aria-disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 whitespace-nowrap flex border gap-1.5 rounded-lg text-(--color-text-toolbar-action) not-disabled:not-aria-disabled:hover:bg-primary-ghost-hover data-[state=open]:bg-primary-ghost-hover border-transparent button-toolbar py-0 text-sm leading-[18px]';

    function createHeaderShareButton(doc, template) {
        const button = template ? template.cloneNode(true) : doc.createElement('button');
        stripIdentity(button);
        button.id = SHARE_BUTTON_ID;
        button.type = 'button';
        button.disabled = false;
        button.removeAttribute('aria-disabled');
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('data-state', 'closed');

        if (!template) {
            button.className = NATIVE_SHARE_CLASS;
            button.setAttribute('aria-label', 'Share');
            const namespace = 'http://www.w3.org/2000/svg';
            const svg = doc.createElementNS(namespace, 'svg');
            for (const [key, value] of Object.entries({ 'aria-hidden': 'true', height: '16', viewBox: '0 0 16 16', width: '16', xmlns: namespace })) {
                svg.setAttribute(key, value);
            }
            const sprite = doc.querySelector('svg use[href*=".svg#"]')?.getAttribute('href');
            if (sprite) {
                const use = doc.createElementNS(namespace, 'use');
                use.setAttribute('href', `${sprite.split('#')[0]}#arrow-up-open-base-light-16`);
                use.setAttribute('fill', 'currentColor');
                svg.appendChild(use);
            } else {
                // Older layouts can inline their icons instead of using a sprite.
                const path = doc.createElementNS(namespace, 'path');
                path.setAttribute('d', 'M8 10.5V1.5m0 0L4.5 5M8 1.5 11.5 5M3 9v4.5h10V9');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'currentColor');
                path.setAttribute('stroke-width', '1.5');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(path);
            }
            button.append(svg, doc.createTextNode('Share'));
        }
        return button;
    }

    function findHeaderActions(doc) {
        // ChatGPT can retain an empty old titlebar during navigation. Only use
        // an action group with actual controls, never that empty duplicate.
        const actionSelector = '[data-app-shell-main-titlebar] [data-app-shell-header-obstacle] .pointer-events-auto';
        // Some temporary chats wrap Save chat in a span directly inside the
        // action container. Prefer the inner group when present, then the
        // container itself, rather than requiring a particular wrapper tag.
        const groups = [
            ...doc.querySelectorAll(`${actionSelector} > div, #conversation-header-actions`),
            ...doc.querySelectorAll(actionSelector)
        ];
        for (const group of groups) {
            if (isVisible(group) && (group.id === 'conversation-header-actions' || group.querySelector('button, [role="button"]'))) return group;
        }
        // Older conversation headers put Share next to their More menu.
        for (const button of doc.querySelectorAll('header button, [role="banner"] button')) {
            if (!isVisible(button) || button.closest('nav, aside, [data-quick-chat-drag-handle]')) continue;
            if (testId(button).includes('conversation-options') || button.getAttribute('aria-label') === 'More') {
                return button.parentElement;
            }
        }
        return null;
    }

    function removeHeaderShareButton(doc) {
        const menu = doc.getElementById(MENU_ID);
        if (menu?.getAttribute('data-export-anchor') === SHARE_BUTTON_ID) closeShareMenu(doc);
        doc.getElementById(SHARE_BUTTON_ID)?.remove();
    }

    function syncHeaderShareButton(doc, state) {
        const nativeShare = findHeaderShareButton(doc);
        if (nativeShare) state.shareTemplate = nativeShare.cloneNode(true);
        if (nativeShare || !state.hasConversation()) {
            removeHeaderShareButton(doc);
            return null;
        }
        const actions = findHeaderActions(doc);
        if (!actions) {
            removeHeaderShareButton(doc);
            return null;
        }
        const existing = doc.getElementById(SHARE_BUTTON_ID);
        if (existing?.parentElement === actions) return existing;
        removeHeaderShareButton(doc);
        const button = createHeaderShareButton(doc, state.shareTemplate);
        actions.insertBefore(button, actions.firstChild);
        return button;
    }

    function install(options = {}) {
        const doc = options.document || (typeof document !== 'undefined' ? document : null);
        const engine = options.engine || globalThis.ChatExporterEngine;
        if (!doc || !engine || doc.defaultView[INSTALL_FLAG]) return false;

        doc.defaultView[INSTALL_FLAG] = true;

        // ChatGPT's Share dialog creates real share links server-side, which
        // "Copy link" cannot replace. The bypass flag lets our "Share…" item
        // re-click the native button without being intercepted again.
        let bypassNativeShare = false;
        let lastShareButton = null;

        // The optional progress card shows the export's progress without
        // changing the native Share button's label.
        const runExport = format => {
            const card = options.progress ? options.progress.create(doc) : null;
            return Promise.resolve()
                .then(() => (engine.exportConversationFull || engine.exportConversation).call(engine, {
                    provider: 'chatgpt',
                    format,
                    onProgress: card ? card.onProgress : undefined
                }))
                .catch(error => {
                    if (card) card.destroy();
                    throw error;
                });
        };

        // A second export must not fight the first for the scroll position.
        let exportInFlight = false;
        const exportSafely = format => {
            if (exportInFlight) return Promise.resolve();
            exportInFlight = true;
            return Promise.resolve()
                .then(() => runExport(format))
                .catch(error => console.error('[Chat Exporter] Export failed.', error))
                .finally(() => { exportInFlight = false; });
        };
        const actions = {
            copyLink: options.copyLink || (() => doc.defaultView.navigator.clipboard.writeText(doc.defaultView.location.href)),
            exportMarkdown: options.exportMarkdown || (() => exportSafely('markdown')),
            exportPdf: options.exportPdf || (() => exportSafely('pdf')),
            openNativeShare: options.openNativeShare || (() => {
                if (!lastShareButton) return;
                bypassNativeShare = true;
                lastShareButton.click();
            })
        };

        // Add a fallback Share button only once there are messages to export.
        const messageSelectors = engine.providers?.chatgpt?.messageSelectors || ['div[data-message-author-role]'];
        const hasConversation = options.hasConversation || (() => messageSelectors.some(selector => {
            try {
                return Boolean(doc.querySelector(selector));
            } catch (error) {
                return false;
            }
        }));

        const state = { hasConversation, shareTemplate: null };

        // A streaming answer fires mutations continuously, so the share-control
        // scan is coalesced instead of running per batch.
        const syncInterval = typeof options.syncInterval === 'number' ? options.syncInterval : DEFAULT_SYNC_INTERVAL;
        let syncScheduled = false;
        const scheduleHeaderSync = () => {
            if (syncInterval <= 0) {
                syncHeaderShareButton(doc, state);
                return;
            }
            if (syncScheduled) return;
            syncScheduled = true;
            doc.defaultView.setTimeout(() => {
                syncScheduled = false;
                syncHeaderShareButton(doc, state);
            }, syncInterval);
        };

        doc.addEventListener('click', event => {
            const fallback = event.target.closest?.(`#${SHARE_BUTTON_ID}`);
            if (fallback) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (doc.getElementById(MENU_ID)?.getAttribute('data-export-anchor') === SHARE_BUTTON_ID) {
                    closeShareMenu(doc);
                } else {
                    openShareMenu(doc, fallback, actions, { includeNativeShare: false, includeCopyLink: false });
                    fallback.setAttribute('aria-expanded', 'true');
                    fallback.setAttribute('data-state', 'open');
                }
                return;
            }

            const shareButton = isHeaderShareButton(event.target);
            if (shareButton) {
                if (bypassNativeShare) {
                    bypassNativeShare = false;
                    return;
                }
                lastShareButton = shareButton;
                event.preventDefault();
                event.stopImmediatePropagation();
                doc.getElementById(MENU_ID)
                    ? closeShareMenu(doc)
                    : openShareMenu(doc, shareButton, actions, { includeNativeShare: true });
                return;
            }
            if (!event.target.closest?.(`#${MENU_ID}`)) closeShareMenu(doc);
        }, true);

        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeShareMenu(doc);
        });

        const start = () => {
            doc.getElementById('chat-exporter-launcher')?.remove();
            injectConversationMenuItems(doc, doc, actions);
            syncHeaderShareButton(doc, state);
            const observer = new doc.defaultView.MutationObserver(records => {
                for (const record of records) {
                    if (record.type === 'attributes') {
                        injectConversationMenuItems(doc, record.target, actions);
                    }
                    for (const node of record.addedNodes) {
                        if (node.nodeType === doc.defaultView.Node.ELEMENT_NODE) {
                            injectConversationMenuItems(doc, node, actions);
                        }
                    }
                }
                scheduleHeaderSync();
            });
            observer.observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'hidden', 'style', 'data-state'],
                childList: true,
                subtree: true
            });
        };

        if (doc.readyState === 'loading') {
            doc.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }

        // Console escape hatch, so an export is always reachable even if every
        // piece of ChatGPT UI we hook into disappears.
        try {
            doc.defaultView.ChatExporter = {
                markdown: () => actions.exportMarkdown(),
                pdf: () => actions.exportPdf()
            };
        } catch (error) {
            console.warn('[Chat Exporter] Could not expose the console helper.', error);
        }
        return true;
    }

    return {
        install,
        internals: {
            injectConversationMenuItems,
            isHeaderShareButton,
            findHeaderShareButton,
            findShareItem,
            findCloneTemplate,
            createHeaderShareButton,
            findHeaderActions,
            syncHeaderShareButton
        }
    };
});
