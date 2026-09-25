const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMwmHnmPwAFJwKVhZG1WQAAAABJRU5ErkJggg==';
const answer = `<h2>Compatibility fixture</h2><p>OK</p>
    <pre><code class="language-javascript">console.log("hello");</code></pre>
    <table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody><tr><td>Price</td><td>$10</td></tr></tbody></table>
    <span data-math="x^2 + y^2 = z^2"><span class="katex">formula</span></span>
    <p><a href="https://example.com">Example source</a></p>`;

function fixture(provider, extra = '', turnsOverride) {
    const user = `<p>Synthetic prompt 👍</p><button aria-label="Preview image"><img alt="Fixture image" src="${png}"></button>`;
    const turns = provider === 'gemini'
        ? `<user-query><div class="query-text">${user}</div></user-query><model-response><message-content>${answer}</message-content></model-response><user-query><div class="query-text">OK</div></user-query>`
        : `<section data-testid="conversation-turn-1"><div data-message-author-role="user" data-message-id="u">${user}</div></section>
           <section data-testid="conversation-turn-2"><div data-message-author-role="assistant" data-message-id="a">${answer}</div></section>
           <section data-testid="conversation-turn-3"><div data-message-author-role="user" data-message-id="r">OK</div></section>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Compatibility fixture${provider === 'gemini' ? ' - Google Gemini' : ''}</title></head><body><main>${turnsOverride ?? turns}</main>${extra}<script src="/__bundle.js"></script></body></html>`;
}

// Every request is intercepted: CI has no provider account, live chat, or token.
async function mount(page, { provider = 'chatgpt', script = 'src/extraction-engine.js', extra = '', strict = false, payload, turns, html } = {}) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const body = html
        ? html.replace('</body>', `${extra}<script src="/__bundle.js"></script></body>`)
        : fixture(provider, extra, turns);
    const bundle = await fs.readFile(path.join(root, script), 'utf8');
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/__bundle.js') return route.fulfill({ contentType: 'application/javascript', body: bundle });
        if (url.pathname === '/api/auth/session') return route.fulfill({ json: { accessToken: 'synthetic-fixture-token' } });
        if (url.pathname.startsWith('/backend-api/conversation/') && payload) return route.fulfill({ json: payload });
        if (route.request().isNavigationRequest() && url.pathname !== '/export.html') {
            return route.fulfill({ contentType: 'text/html', body, headers: strict ? {
                'content-security-policy': "script-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'"
            } : {} });
        }
        return route.fulfill({ status: 404, body: '' });
    });
    await page.goto(provider === 'gemini' ? 'https://gemini.google.com/app/fixture'
        : payload ? 'https://chatgpt.com/c/fixture' : 'https://chatgpt.com/?temporary-chat=true');
    return errors;
}

async function downloadedText(download) {
    expect(await download.failure()).toBeNull();
    return fs.readFile(await download.path(), 'utf8');
}

for (const provider of ['chatgpt', 'gemini']) {
    for (const format of ['markdown', 'html', 'pdf']) {
        test(`${provider} ${format}: real download preserves rich content, images, math and repeated turns`, async ({ page }) => {
            const errors = await mount(page, { provider });
            const downloading = page.waitForEvent('download');
            const result = await page.evaluate(async ({ provider, format }) => {
                const output = await window.ChatExporterEngine.exportConversationFull({
                    provider, format, scroll: false, awaitStreaming: false, chatGptMetadata: false, notify: false
                });
                return { count: output.conversation.messages.length, complete: output.conversation.complete, content: output.content };
            }, { provider, format });
            const download = await downloading;
            const text = await downloadedText(download);
            expect(text).toBe(result.content);
            expect(result.count).toBe(3);
            expect(result.complete).toBe(true);
            expect(download.suggestedFilename()).toMatch(format === 'markdown' ? /\.md$/ : /\.html$/);
            for (const expected of ['Synthetic prompt', '👍', 'console.log', 'Price', 'x^2 + y^2 = z^2', 'https://example.com', 'data:image/png']) expect(text).toContain(expected);
            if (format !== 'markdown') {
                await page.route('**/export.html', route => route.fulfill({ contentType: 'text/html', body: text }));
                await page.goto('https://chatgpt.com/export.html');
                await expect(page.locator('table')).toHaveCount(1);
                await expect(page.locator('img.exported-media')).toHaveCount(1);
                await expect.poll(() => page.locator('img.exported-media').evaluate(image => image.naturalWidth)).toBe(1);
                await expect(page.locator('script')).toHaveCount(0);
            }
            expect(errors).toEqual([]);
        });
    }
}

const runners = [
    ['chatgpt-markdown', 'exporter-markdown.js'], ['chatgpt-html', 'exporter-html.js'],
    ['chatgpt-pdf', 'exporter-pdf.js'], ['gemini-markdown', 'gemini-exporter-markdown.js']
];
for (const [id, script] of runners) {
    test(`${id}: shipped console bundle downloads`, async ({ page }) => {
        const downloading = page.waitForEvent('download');
        const errors = await mount(page, { provider: id.startsWith('gemini') ? 'gemini' : 'chatgpt', script });
        const text = await downloadedText(await downloading);
        expect(text).toContain('Synthetic prompt');
        expect(text).toContain('Compatibility fixture');
        expect(errors).toEqual([]);
    });
    test(`${id}: full bookmarklet URL executes without replacing the page`, async ({ page }) => {
        const uri = (await fs.readFile(path.join(root, 'public/bookmarklets', `${id}.txt`), 'utf8')).trim();
        const errors = await mount(page, { provider: id.startsWith('gemini') ? 'gemini' : 'chatgpt',
            extra: `<a id="bookmark" href="${uri.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">Run bookmarklet</a>` });
        const downloading = page.waitForEvent('download');
        await page.locator('#bookmark').click();
        expect(await downloadedText(await downloading)).toContain('Synthetic prompt');
        await expect(page.locator('#bookmark')).toHaveText('Run bookmarklet');
        expect(errors).toEqual([]);
    });
}

for (const script of ['chatgpt-markdown-exporter.user.js', 'chatgpt-pdf-exporter.user.js']) {
    for (const label of ['Export to Markdown', 'Export to PDF']) {
        test(`${script}: ${label} without Share under strict CSP and Trusted Types`, async ({ page, browserName }) => {
            const errors = await mount(page, { script, strict: true });
            if (browserName === 'chromium') {
                expect(await page.evaluate(() => {
                    try { new DOMParser().parseFromString('<svg/>', 'image/svg+xml'); return false; }
                    catch (error) { return error instanceof TypeError; }
                })).toBe(true);
            }
            await expect(page.locator('#chat-exporter-launcher svg')).toBeVisible();
            await page.locator('#chat-exporter-launcher').click();
            await expect(page.locator('#chat-exporter-share-menu svg')).toHaveCount(3);
            const downloading = page.waitForEvent('download');
            await page.getByRole('menuitem', { name: label, exact: true }).click();
            expect(await downloadedText(await downloading)).toContain('Synthetic prompt');
            expect(errors).toEqual([]);
        });
    }
}

function conversation(count) {
    const mapping = {};
    for (let i = 0; i < count; i++) mapping[`n${i}`] = {
        parent: i ? `n${i - 1}` : null, children: i + 1 < count ? [`n${i + 1}`] : [],
        message: { id: `m${i}`, status: 'finished_successfully', author: { role: i % 2 ? 'assistant' : 'user' },
            content: { content_type: 'text', parts: [`Synthetic turn ${i}`] }, metadata: {}, create_time: 1789800000 + i }
    };
    return { current_node: `n${count - 1}`, mapping };
}

test('1,243-message payload preserves every turn, order and timestamps without scrolling', async ({ page }) => {
    await mount(page, { payload: conversation(1243) });
    const result = await page.evaluate(async () => {
        const value = await window.ChatExporterEngine.extractConversationFull({ provider: 'chatgpt', format: 'markdown' });
        return { source: value.source, complete: value.complete, messages: value.messages.map(m => ({ content: m.content, timestamp: m.timestampIso })) };
    });
    expect(result.source).toBe('payload');
    expect(result.complete).toBe(true);
    expect(result.messages).toHaveLength(1243);
    result.messages.forEach((message, index) => {
        expect(message.content).toBe(`Synthetic turn ${index}`);
        expect(message.timestamp).toBe(new Date((1789800000 + index) * 1000).toISOString());
    });
});

for (const format of ['markdown', 'html', 'pdf']) {
    test(`${format}: app-backed research report recovers independently of an iframe`, async ({ page }) => {
        const payload = conversation(2);
        payload.mapping.n1.message = { id: 'research', author: { role: 'tool', name: 'research' },
            content: { content_type: 'text', parts: [] }, metadata: { chatgpt_sdk: { widget_state: { report_message: {
                id: 'report', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['# Synthetic research\n\nVerified report body.'] }, metadata: {}
            } } } } };
        await mount(page, { payload, turns: '<div data-message-author-role="user" data-message-id="m0">Synthetic turn 0</div>' });
        const result = await page.evaluate(async format => window.ChatExporterEngine.extractConversationFull({
            provider: 'chatgpt', format, scroll: false, awaitStreaming: false
        }), format);
        expect(result.messages.some(message => message.content.includes('Verified report body.'))).toBe(true);
        expect(result.unresolvedReports).toBe(0);
        expect(result.messages).toHaveLength(2);
        expect(result.complete).toBe(true);
    });
}

// ChatGPT's second transcript layout, as served live on 2026-09-25: turns are
// li[data-message-role], prompts sit inside buttons, sources are buttons
// carrying JSON. Nothing in it matched before v1.2.0.
const transcript2026 = () => fs.readFile(path.join(root, 'test/fixtures/chatgpt-transcript-2026.html'), 'utf8');

for (const format of ['markdown', 'html', 'pdf']) {
    test(`chatgpt 2026 transcript ${format}: every turn, prompt and source is exported`, async ({ page }) => {
        const errors = await mount(page, { html: await transcript2026() });
        const result = await page.evaluate(async format => {
            const output = await window.ChatExporterEngine.exportConversationFull({
                provider: 'chatgpt', format, awaitStreaming: false, download: false, notify: false
            });
            return { count: output.conversation.messages.length, complete: output.conversation.complete, content: output.content };
        }, format);
        expect(result.count).toBe(6);
        expect(result.complete).toBe(true);
        for (const expected of ['Hi! How can I help?', 'keep this indent', 'print(', 'Official Node.js releases', 'References']) expect(result.content).toContain(expected);
        expect(result.content).not.toContain('said:');
        if (format === 'markdown') {
            expect(result.content).toContain('### **You**\n\nHi\n');
            expect(result.content).toContain('```python');
            expect(result.content).toContain('$$a+b$$');
        }
        expect(errors).toEqual([]);
    });
}

test('chatgpt 2026 transcript: the userscript launcher exports it under strict CSP', async ({ page }) => {
    const errors = await mount(page, { html: await transcript2026(), script: 'chatgpt-markdown-exporter.user.js', strict: true });
    await expect(page.locator('#chat-exporter-launcher')).toBeVisible();
    await page.locator('#chat-exporter-launcher').click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export to Markdown', exact: true }).click();
    const text = await downloadedText(await downloading);
    expect(text).toContain('### **You**\n\nHi\n');
    expect(text).toContain('[Official Node.js releases](https://nodejs.org/en/about/previous-releases)');
    expect(errors).toEqual([]);
});
