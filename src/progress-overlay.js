(function initChatExporterProgress(root, factory) {
    const progress = factory();

    if (root) {
        root.ChatExporterProgress = progress;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = progress;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildChatExporterProgress() {
    'use strict';

    // A card pinned over the conversation while a sweep runs, so a long export
    // shows its work instead of looking like a frozen tab.
    //
    // Three rules govern everything here, and each one is a bug this project
    // has already paid for:
    //
    //  1. No HTML injection sinks. ChatGPT deployments can enforce Trusted
    //     Types, where innerHTML and friends throw. Nodes are built with
    //     createElement/textContent only, and styles are set per-property
    //     rather than injected as a stylesheet.
    //  2. The overlay can never break an export. Every entry point is wrapped;
    //     a failure here costs the reader a progress bar, never their file.
    //  3. The overlay must not be exportable. It carries data-chat-exporter-ui
    //     so the engine can exclude it, sits outside the conversation
    //     container, and is position: fixed so it cannot change the container's
    //     scroll height mid-sweep.

    const CONTAINER_ID = 'chat-exporter-progress';
    const LINGER_AFTER_DONE = 2600;

    const PHASE_LABEL = {
        start: 'Preparing export…',
        streaming: 'Waiting for the answer to finish…',
        hidden: 'Paused — bring this tab to the front',
        resumed: 'Resuming…',
        sweep: 'Reading conversation…',
        metadata: 'Adding timestamps and attachments…',
        done: 'Export complete'
    };

    function styleOf(element, styles) {
        Object.keys(styles).forEach(property => {
            try {
                element.style[property] = styles[property];
            } catch (error) {
                // A refused property is cosmetic; keep going.
            }
        });
    }

    function element(doc, tag, styles, text) {
        const node = doc.createElement(tag);
        if (styles) styleOf(node, styles);
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function formatCount(value) {
        const number = Number(value) || 0;
        return number >= 1000 ? `${Math.floor(number / 1000)},${String(number % 1000).padStart(3, '0')}` : String(number);
    }

    function build(doc) {
        const card = element(doc, 'div', {
            position: 'fixed',
            left: '20px',
            bottom: '20px',
            zIndex: '2147483646',
            width: '300px',
            maxWidth: 'calc(100vw - 40px)',
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(24, 24, 27, 0.94)',
            color: '#f4f4f5',
            font: '13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.32)',
            // The reader must never have to fight this for a click.
            pointerEvents: 'none',
            transition: 'opacity 240ms ease'
        });
        card.id = CONTAINER_ID;
        card.setAttribute('data-chat-exporter-ui', 'progress');
        // Announced politely rather than stealing focus from the page.
        card.setAttribute('role', 'status');
        card.setAttribute('aria-live', 'polite');

        const title = element(doc, 'div', {
            fontWeight: '600',
            letterSpacing: '0.01em',
            marginBottom: '8px'
        }, 'Chat Exporter');

        const status = element(doc, 'div', {
            color: '#d4d4d8',
            marginBottom: '10px'
        }, PHASE_LABEL.start);

        const track = element(doc, 'div', {
            height: '5px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.14)',
            overflow: 'hidden'
        });
        const bar = element(doc, 'div', {
            height: '100%',
            width: '0%',
            borderRadius: '999px',
            background: '#22c55e',
            transition: 'width 200ms ease'
        });
        track.appendChild(bar);

        const stats = element(doc, 'div', {
            marginTop: '10px',
            color: '#a1a1aa',
            fontVariantNumeric: 'tabular-nums'
        }, '0 messages');

        const preview = element(doc, 'div', {
            marginTop: '6px',
            color: '#71717a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        }, '');

        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(track);
        card.appendChild(stats);
        card.appendChild(preview);

        return { card, status, bar, stats, preview };
    }

    function create(doc, options = {}) {
        const noop = { onProgress() {}, destroy() {} };
        if (!doc || typeof doc.createElement !== 'function' || !doc.body) return noop;

        let parts = null;
        try {
            doc.getElementById(CONTAINER_ID)?.remove();
            parts = build(doc);
            doc.body.appendChild(parts.card);
        } catch (error) {
            console.warn('[Chat Exporter] Progress display unavailable; the export continues.', error);
            return noop;
        }

        const win = doc.defaultView;
        const setTimer = win?.setTimeout?.bind(win) || setTimeout;
        let removed = false;

        const destroy = () => {
            if (removed) return;
            removed = true;
            try {
                parts.card.remove();
            } catch (error) {
                // Already detached.
            }
        };

        const onProgress = event => {
            if (removed || !event) return;
            try {
                const phase = String(event.phase || '');
                parts.status.textContent = PHASE_LABEL[phase] || PHASE_LABEL.sweep;

                if (typeof event.percent === 'number') {
                    parts.bar.style.width = `${Math.max(0, Math.min(100, event.percent))}%`;
                }
                if (phase === 'hidden') {
                    parts.bar.style.background = '#f59e0b';
                } else if (phase !== 'done') {
                    parts.bar.style.background = '#22c55e';
                }

                const pieces = [`${formatCount(event.messages)} message${event.messages === 1 ? '' : 's'}`];
                if (event.lines) pieces.push(`${formatCount(event.lines)} lines`);
                if (phase === 'done' && event.expectedMessages) {
                    pieces[0] = `${formatCount(event.messages)} of ${formatCount(event.expectedMessages)} messages`;
                }
                parts.stats.textContent = pieces.join(' · ');

                if (event.lastPreview) {
                    parts.preview.textContent = event.lastSender
                        ? `${event.lastSender}: ${event.lastPreview}`
                        : event.lastPreview;
                }

                if (phase !== 'done') return;

                // Say plainly when the file is short: a green bar over an
                // incomplete export is worse than no bar at all.
                if (event.complete === false) {
                    parts.status.textContent = event.unreachedMessages
                        ? `Incomplete — ${formatCount(event.unreachedMessages)} message(s) never loaded`
                        : 'Finished, but this export may be incomplete';
                    parts.bar.style.background = '#f59e0b';
                } else {
                    parts.bar.style.background = '#22c55e';
                    // Recovery is worth saying out loud: the reader's file is
                    // complete, but part of it did not come off the screen.
                    if (event.recoveredMessages) {
                        parts.status.textContent =
                            `Export complete — ${formatCount(event.recoveredMessages)} recovered from ChatGPT's record`;
                    }
                }

                if (options.linger === false) {
                    destroy();
                    return;
                }
                setTimer(() => {
                    try {
                        parts.card.style.opacity = '0';
                    } catch (error) {
                        // Cosmetic only.
                    }
                    setTimer(destroy, 260);
                }, LINGER_AFTER_DONE);
            } catch (error) {
                // A progress card that cannot draw itself gets out of the way.
                destroy();
            }
        };

        return { onProgress, destroy };
    }

    return { create, CONTAINER_ID };
});
