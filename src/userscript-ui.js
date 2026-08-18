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
    const LAUNCHER_ID = 'chat-exporter-launcher';
    const NATIVE_ITEM_ATTRIBUTE = 'data-chat-exporter-item';
    const INSTALL_FLAG = '__CHAT_EXPORTER_UI_INSTALLED__';

    // Milliseconds to let ChatGPT finish rendering its header before deciding
    // that no native share control exists and mounting our own launcher.
    const DEFAULT_LAUNCHER_DELAY = 1500;

    // Milliseconds between share-control scans while the page mutates.
    const DEFAULT_SYNC_INTERVAL = 400;

    const ICONS = {
        share: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
        link: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
        markdown: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="M7 15V9l3 3 3-3v6"/><path d="m16 12 2 2 2-2"/></svg>',
        pdf: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 16h6M9 12h3"/></svg>',
        download: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>'
    };

    function normalizeText(element) {
        return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element) {
        return Boolean(element && element.getClientRects().length);
    }

    // ChatGPT ships a Trusted Types policy on some deployments, where assigning
    // innerHTML throws. DOMParser is not a Trusted Types sink, so icons are
    // parsed out-of-document and imported as nodes instead.
    function renderIcon(doc, markup) {
        try {
            const parsed = new doc.defaultView.DOMParser().parseFromString(markup, 'image/svg+xml');
            const svg = parsed.documentElement;
            if (svg && String(svg.nodeName).toLowerCase() === 'svg') {
                return doc.importNode(svg, true);
            }
        } catch (error) {
            console.warn('[Chat Exporter] Could not render an icon; falling back to text.', error);
        }
        return null;
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
    // `section[data-testid="conversation-turn-N"]`. Those share the current
    // message, not the conversation, and must keep their native behaviour.
    const TURN_CONTAINER = '[data-message-author-role], [data-testid^="conversation-turn"], [data-testid^="conversation_turn"], article';

    // The data-testid hook works on every ChatGPT locale; the English text
    // match is a fallback for DOM revisions that drop the testid.
    function isHeaderShareButton(element) {
        const button = element?.closest?.('button, [role="button"]');
        if (!button) return null;
        if (button.closest('[role="menu"], [data-radix-menu-content]')) return null;
        if (button.closest(`#${MENU_ID}, #${LAUNCHER_ID}`)) return null;
        if (button.closest(TURN_CONTAINER)) return null;

        if (testId(button).includes('share')) return button;
        return normalizeText(button) === 'Share' ? button : null;
    }

    function findHeaderShareButton(doc) {
        const candidates = doc.querySelectorAll('button, [role="button"]');
        for (const candidate of candidates) {
            const button = isHeaderShareButton(candidate);
            if (button && isVisible(button)) return button;
        }
        return null;
    }

    function createLauncher(doc, actions) {
        const launcher = doc.createElement('button');
        launcher.id = LAUNCHER_ID;
        launcher.type = 'button';
        launcher.setAttribute('aria-haspopup', 'menu');
        launcher.title = 'Export this conversation';
        launcher.style.cssText = [
            'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
            'display:flex', 'align-items:center', 'gap:8px',
            'padding:10px 14px', 'border:0', 'border-radius:999px',
            'background:#10a37f', 'color:#fff', 'cursor:pointer',
            'font-family:ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            'font-size:14px', 'font-weight:600',
            'box-shadow:0 2px 8px rgba(0,0,0,.25)'
        ].join(';');

        const glyph = renderIcon(doc, ICONS.download);
        if (glyph) launcher.appendChild(glyph);
        const label = doc.createElement('span');
        label.textContent = 'Export';
        launcher.appendChild(label);

        launcher.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (doc.getElementById(MENU_ID)) {
                closeShareMenu(doc);
                return;
            }
            openShareMenu(doc, launcher, actions, { includeNativeShare: false });
        });
        return launcher;
    }

    // Writing an unchanged style value still queues a mutation record, which
    // would feed our own observer back into this function forever.
    function setLauncherVisible(launcher, visible) {
        const display = visible ? 'flex' : 'none';
        if (launcher.style.display !== display) launcher.style.display = display;
    }

    // Native menu integration depends on a ChatGPT affordance that enterprise
    // policies can remove entirely. The launcher is the guaranteed entry point:
    // it appears whenever no share control is on the page (issue #31).
    function syncLauncher(doc, actions, state) {
        const launcher = doc.getElementById(LAUNCHER_ID);
        if (!state.forced && (findHeaderShareButton(doc) || !state.hasConversation())) {
            if (launcher) setLauncherVisible(launcher, false);
            return launcher;
        }
        if (!doc.body) return null;
        if (launcher) {
            setLauncherVisible(launcher, true);
            return launcher;
        }
        if (state.launcherDelay > 0 && doc.defaultView.Date.now() - state.startedAt < state.launcherDelay) {
            return null;
        }
        const mounted = createLauncher(doc, actions);
        doc.body.appendChild(mounted);
        return mounted;
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

        // The launcher already says "Exporting…", but a sweep takes seconds and
        // a label alone does not show it is still working. The card is optional:
        // a build without one exports exactly as before.
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

        // A full export scrolls the whole conversation, which takes seconds.
        // Say so on the launcher, and don't let a second click start a second
        // sweep fighting the first one for the scroll position.
        let exportInFlight = false;
        // The busy *state* still guards against a second sweep fighting the
        // first for the scroll position — that is the part that matters. The
        // label only speaks when there is no progress card saying it better.
        const setBusy = busy => {
            exportInFlight = busy;
            const label = doc.getElementById(LAUNCHER_ID)?.querySelector('span');
            if (!label) return;
            const cardVisible = Boolean(options.progress && doc.getElementById('chat-exporter-progress'));
            label.textContent = busy && !cardVisible ? 'Exporting…' : 'Export';
        };
        const exportSafely = format => {
            if (exportInFlight) return Promise.resolve();
            setBusy(true);
            return Promise.resolve()
                .then(() => runExport(format))
                .catch(error => console.error('[Chat Exporter] Export failed.', error))
                .then(() => setBusy(false), () => setBusy(false));
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

        // Nothing to export on the landing page or a brand-new chat, so the
        // launcher stays out of the way until the conversation has messages.
        const messageSelectors = engine.providers?.chatgpt?.messageSelectors || ['div[data-message-author-role]'];
        const hasConversation = options.hasConversation || (() => messageSelectors.some(selector => {
            try {
                return Boolean(doc.querySelector(selector));
            } catch (error) {
                return false;
            }
        }));

        const state = {
            startedAt: doc.defaultView.Date.now(),
            launcherDelay: typeof options.launcherDelay === 'number' ? options.launcherDelay : DEFAULT_LAUNCHER_DELAY,
            hasConversation
        };

        // A streaming answer fires mutations continuously, so the share-control
        // scan is coalesced instead of running per batch.
        const syncInterval = typeof options.syncInterval === 'number' ? options.syncInterval : DEFAULT_SYNC_INTERVAL;
        let syncScheduled = false;
        const scheduleLauncherSync = () => {
            if (syncInterval <= 0) {
                syncLauncher(doc, actions, state);
                return;
            }
            if (syncScheduled) return;
            syncScheduled = true;
            doc.defaultView.setTimeout(() => {
                syncScheduled = false;
                syncLauncher(doc, actions, state);
            }, syncInterval);
        };

        doc.addEventListener('click', event => {
            if (event.target.closest?.(`#${LAUNCHER_ID}`)) return;

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
            injectConversationMenuItems(doc, doc, actions);
            syncLauncher(doc, actions, state);
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
                scheduleLauncherSync();
            });
            observer.observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'hidden', 'style', 'data-state'],
                childList: true,
                subtree: true
            });
            // ChatGPT can settle without further mutations; re-check once the
            // header has had time to render.
            if (state.launcherDelay > 0) {
                doc.defaultView.setTimeout(() => syncLauncher(doc, actions, state), state.launcherDelay + 100);
            }
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
                pdf: () => actions.exportPdf(),
                showLauncher: () => {
                    state.forced = true;
                    state.launcherDelay = 0;
                    return syncLauncher(doc, actions, state);
                }
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
            syncLauncher
        }
    };
});
