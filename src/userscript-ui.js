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
    const NATIVE_ITEM_ATTRIBUTE = 'data-chat-exporter-item';
    const INSTALL_FLAG = '__CHAT_EXPORTER_UI_INSTALLED__';

    const ICONS = {
        link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
        markdown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="M7 15V9l3 3 3-3v6"/><path d="m16 12 2 2 2-2"/></svg>',
        pdf: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 16h6M9 12h3"/></svg>'
    };

    function normalizeText(element) {
        return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element) {
        return Boolean(element && element.getClientRects().length);
    }

    function closeShareMenu(doc) {
        doc.getElementById(MENU_ID)?.remove();
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
        item.innerHTML = `${icon}<span>${label}</span>`;
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

    function openShareMenu(doc, anchor, actions) {
        closeShareMenu(doc);

        const menu = doc.createElement('div');
        menu.id = MENU_ID;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Conversation export options');
        menu.style.cssText = [
            'position:fixed', 'z-index:100000', 'min-width:210px', 'padding:6px',
            'border:1px solid var(--border-light, rgba(127,127,127,.22))',
            'border-radius:12px', 'background:var(--main-surface-primary, #fff)',
            'color:var(--text-primary, #111)',
            'box-shadow:0 12px 32px rgba(0,0,0,.22)',
            'font-family:ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        ].join(';');

        menu.append(
            createMenuItem(doc, 'Copy link', ICONS.link, async item => {
                try {
                    await actions.copyLink();
                    item.querySelector('span').textContent = 'Copied!';
                    doc.defaultView.setTimeout(() => closeShareMenu(doc), 650);
                } catch (error) {
                    console.error('[Chat Exporter] Could not copy the conversation link.', error);
                    item.querySelector('span').textContent = 'Copy failed';
                }
            }),
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

    function replaceShareLabel(doc, item, label) {
        const walker = doc.createTreeWalker(item, doc.defaultView.NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeValue.trim() === 'Share') {
                node.nodeValue = node.nodeValue.replace('Share', label);
                return true;
            }
        }
        return false;
    }

    function cloneNativeItem(doc, shareItem, label, format, action) {
        const item = shareItem.cloneNode(true);
        item.setAttribute(NATIVE_ITEM_ATTRIBUTE, format);
        item.removeAttribute('data-state');
        item.removeAttribute('id');
        item.removeAttribute('aria-controls');
        item.removeAttribute('aria-expanded');
        item.removeAttribute('aria-haspopup');
        item.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        replaceShareLabel(doc, item, label);
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

    function injectConversationMenuItems(doc, root, actions) {
        const menus = findMenus(root).filter(isVisible);
        for (const menu of menus) {
            if (menu.querySelector(`[${NATIVE_ITEM_ATTRIBUTE}]`)) continue;

            const candidates = Array.from(menu.querySelectorAll('button, [role="menuitem"], a, div'));
            const shareItem = candidates.find(item => isVisible(item) && normalizeText(item) === 'Share');
            if (!shareItem) continue;

            const markdownItem = cloneNativeItem(
                doc,
                shareItem,
                'Export to Markdown',
                'markdown',
                actions.exportMarkdown
            );
            const pdfItem = cloneNativeItem(
                doc,
                shareItem,
                'Export to PDF',
                'pdf',
                actions.exportPdf
            );
            shareItem.insertAdjacentElement('afterend', pdfItem);
            shareItem.insertAdjacentElement('afterend', markdownItem);
        }
    }

    function isHeaderShareButton(element) {
        const button = element?.closest?.('button');
        if (!button || normalizeText(button) !== 'Share') return null;
        if (button.closest('[role="menu"], [data-radix-menu-content]')) return null;
        return button;
    }

    function install(options = {}) {
        const doc = options.document || (typeof document !== 'undefined' ? document : null);
        const engine = options.engine || globalThis.ChatExporterEngine;
        if (!doc || !engine || doc.defaultView[INSTALL_FLAG]) return false;

        doc.defaultView[INSTALL_FLAG] = true;
        const actions = {
            copyLink: options.copyLink || (() => doc.defaultView.navigator.clipboard.writeText(doc.defaultView.location.href)),
            exportMarkdown: options.exportMarkdown || (() => engine.exportConversation({ provider: 'chatgpt', format: 'markdown' })),
            exportPdf: options.exportPdf || (() => engine.exportConversation({ provider: 'chatgpt', format: 'pdf' }))
        };

        doc.addEventListener('click', event => {
            const shareButton = isHeaderShareButton(event.target);
            if (shareButton) {
                event.preventDefault();
                event.stopImmediatePropagation();
                doc.getElementById(MENU_ID)
                    ? closeShareMenu(doc)
                    : openShareMenu(doc, shareButton, actions);
                return;
            }
            if (!event.target.closest?.(`#${MENU_ID}`)) closeShareMenu(doc);
        }, true);

        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeShareMenu(doc);
        });

        const start = () => {
            injectConversationMenuItems(doc, doc, actions);
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
        return true;
    }

    return {
        install,
        internals: {
            injectConversationMenuItems,
            isHeaderShareButton
        }
    };
});
