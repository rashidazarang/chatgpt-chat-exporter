const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine.js');
const userscriptUi = require('../src/userscript-ui.js');

const repoRoot = path.resolve(__dirname, '..');

function readScript(filename) {
    return fs.readFileSync(path.join(repoRoot, filename), 'utf8');
}

function readFixture(filename) {
    return fs.readFileSync(path.join(repoRoot, 'test', 'fixtures', filename), 'utf8');
}

function chatGptFixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Modern ChatGPT Fixture</title></head>
<body>
    <main>
        <div data-message-author-role="user">
            <p>Can you export this code table and math example for me please?</p>
        </div>
        <div data-message-author-role="assistant">
            <p>The inline mean is
                <span class="katex">
                    <span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\\mu</annotation></semantics></math></span>
                    <span class="katex-html">mu</span>
                </span>
                and the density is below.
            </p>
            <span class="katex-display">
                <span class="katex">
                    <span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">f(x \\mid \\mu)</annotation></semantics></math></span>
                    <span class="katex-html">visual duplicate</span>
                </span>
            </span>
            <pre>
                <div class="sticky top-0"><div>JavaScript</div><button aria-label="Copy">Copy</button></div>
                <div class="cm-editor">
                    <div class="cm-content">
                        <div class="cm-line">function hi() {</div>
                        <div class="cm-line">  return "ok";</div>
                        <div class="cm-line">}</div>
                    </div>
                </div>
            </pre>
            <table>
                <thead><tr><th>Name</th><th>Value</th></tr></thead>
                <tbody><tr><td>alpha</td><td>1</td></tr></tbody>
            </table>
            <p>See <a href="https://example.com/a)b">Example [link]</a>.</p>
            <img alt="plot">
        </div>
    </main>
</body>
</html>`;
}

function geminiFixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Gemini Fixture</title></head>
<body>
    <main>
        <user-query>
            <p>Please export this Gemini code table and linked source for me.</p>
        </user-query>
        <model-response>
            <p>Certainly, here is a compact Gemini answer with code, table, and media.</p>
            <pre><code class="language-python">print("hello")
print("world")</code></pre>
            <table>
                <tr><th>Tool</th><th>Status</th></tr>
                <tr><td>Gemini</td><td>Current</td></tr>
            </table>
            <a href="https://gemini.google.com/">Gemini home</a>
            <canvas aria-label="chart"></canvas>
        </model-response>
    </main>
</body>
</html>`;
}

function fenceInjectionFixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Fence Injection Fixture</title></head>
<body>
    <main>
        <div data-message-author-role="user">
            <p>Please show a code block that contains markdown fences.</p>
        </div>
        <div data-message-author-role="assistant">
            <pre>
                <div class="code-header">JavaScript \`\`\` bad</div>
                <code>const start = "ok";
\`\`\`
const done = true;</code>
            </pre>
        </div>
    </main>
</body>
</html>`;
}

function issue25Fixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Newline character example</title></head>
<body>
    <main>
        <div data-message-author-role="user">
            <div class="whitespace-pre-wrap">What is \\n ?
Show me a 5-line example.

Make no mistakes.
    return indented;</div>
        </div>
        <div data-message-author-role="assistant">
            <div class="markdown prose">
                <p><code>\\n</code> is the <strong>newline character</strong> (also called a <strong>line feed</strong>, LF).</p>
                <p>Inline backticks like <code>a\`b</code> need longer delimiters.</p>
                <p>Escape &amp;amp; as <code>&amp;amp;</code> and &amp;lt;div&amp;gt; stays literal.</p>
                <pre><code><span>Line 1</span><br><span>Line 2</span><br><span>Line 3</span></code></pre>
                <table>
                    <tr><th>Sequence</th><th>Path</th></tr>
                    <tr><td>\\n</td><td>C:\\temp | D:\\data</td></tr>
                </table>
            </div>
        </div>
    </main>
</body>
</html>`;
}

function issue32And33Fixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Attachment Metadata Fixture</title></head>
<body>
    <main>
        <section data-testid="conversation-turn-0">
            <div data-message-author-role="user" data-message-id="message-user-image">
                <div class="whitespace-pre-wrap"></div>
            </div>
            <div data-testid="file-thumbnail">
                <img
                    alt="uploaded-sketch.png"
                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                >
            </div>
            <button data-testid="file-thumbnail" aria-label="Uploaded_Filename.zip">Uploaded_Filename.zip</button>
            <time datetime="2026-06-09T12:47:00-06:00">Tue, Jun 9 at 12:47 PM</time>
        </section>
        <section data-testid="conversation-turn-1">
            <div data-message-author-role="assistant" data-message-id="message-assistant-file">
                <div class="markdown prose"><p>Created the requested workbook.</p></div>
            </div>
            <a data-testid="generated-file" href="sandbox:/mnt/data/ABC_Workbook.xlsx">Download ABC Workbook</a>
            <div data-testid="reasoning-recap">Checked the formulas before saving.</div>
            <time datetime="2026-06-09T12:48:00-06:00">Tue, Jun 9 at 12:48 PM</time>
        </section>
    </main>
</body>
</html>`;
}

function chatGptConversationPayload() {
    return {
        title: 'Payload Metadata Fixture',
        current_node: 'node-assistant',
        mapping: {
            'node-user': {
                id: 'node-user',
                parent: null,
                children: ['node-recap'],
                message: {
                    id: 'message-user-api',
                    author: { role: 'user' },
                    create_time: 1781030820,
                    content: { content_type: 'multimodal_text', parts: [{ content_type: 'image_asset_pointer', asset_pointer: 'file-service://file-image-api' }] },
                    metadata: {
                        attachments: [{ id: 'file-image-api', name: 'uploaded-diagram.png', mime_type: 'image/png' }]
                    }
                }
            },
            'node-recap': {
                id: 'node-recap',
                parent: 'node-user',
                children: ['node-assistant'],
                message: {
                    id: 'message-recap-api',
                    author: { role: 'assistant' },
                    create_time: 1781030870,
                    content: { content_type: 'reasoning_recap', parts: ['Checked workbook formulas and output paths.'] },
                    metadata: {}
                }
            },
            'node-assistant': {
                id: 'node-assistant',
                parent: 'node-recap',
                children: [],
                message: {
                    id: 'message-assistant-api',
                    author: { role: 'assistant' },
                    create_time: 1781030880,
                    content: {
                        content_type: 'text',
                        parts: ['Created the workbook. [Download the ABC Workbook](sandbox:/mnt/data/ABC_Workbook.xlsx)']
                    },
                    metadata: {}
                }
            }
        }
    };
}

function installInnerText(window) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'innerText');
    if (!descriptor) {
        Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
            get() {
                return this.textContent;
            },
            set(value) {
                this.textContent = value;
            }
        });
    }
}

async function runExporter(filename, html, url = 'https://chatgpt.com/c/test-fixture') {
    const dom = new JSDOM(html, {
        url,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });

    const { window } = dom;
    installInnerText(window);

    const downloads = [];
    window.URL.createObjectURL = blob => {
        downloads.push({ blob, filename: null });
        return `blob:download-${downloads.length}`;
    };
    window.URL.revokeObjectURL = () => {};
    window.alert = () => {};
    window.console = console;
    window.HTMLAnchorElement.prototype.click = function click() {
        const latest = downloads[downloads.length - 1];
        if (latest) latest.filename = this.download;
    };

    window.eval(readScript(filename));

    // Runners export through the async full-extraction path, which waits for
    // the newest answer to stop growing before it reads anything — poll for the
    // download rather than assuming a fixed number of ticks.
    const deadline = Date.now() + 5000;
    while (downloads.length === 0 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }

    assert.ok(downloads.length > 0, `${filename} should create a downloadable blob`);
    const latest = downloads[downloads.length - 1];
    return {
        filename: latest.filename,
        content: await latest.blob.text()
    };
}

const SHARE_UI_FIXTURE = `<!DOCTYPE html>
<html>
<body>
    <header><button id="header-share"><span>Share</span></button></header>
    <div id="conversation-menu" role="menu">
        <button role="menuitem"><svg aria-hidden="true"></svg><span>Share</span></button>
        <button role="menuitem"><span>Rename</span></button>
    </div>
    <div data-message-author-role="user"><div class="markdown"><p>Hello</p></div></div>
</body>
</html>`;

// An account with sharing disabled by policy: no header share control and no
// Share entry in the conversation menu (issue #31).
const NO_SHARE_UI_FIXTURE = `<!DOCTYPE html>
<html>
<body>
    <header><button id="header-menu"><span>Open menu</span></button></header>
    <div id="conversation-menu" role="menu">
        <button role="menuitem" data-testid="rename-chat-menu-item"><span>Rename</span></button>
        <button role="menuitem" data-testid="delete-chat-menu-item"><span>Delete</span></button>
    </div>
    <div data-message-author-role="user"><div class="markdown"><p>Hello</p></div></div>
    <div data-message-author-role="assistant"><div class="markdown"><p>Hi there</p></div></div>
</body>
</html>`;

function installUserscriptUi(options = {}) {
    const dom = new JSDOM(options.markup || SHARE_UI_FIXTURE, {
        url: 'https://chatgpt.com/c/ui-fixture',
        pretendToBeVisual: true
    });
    const { window } = dom;
    window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
    window.HTMLElement.prototype.getBoundingClientRect = () => ({
        top: 10,
        right: 200,
        bottom: 40,
        left: 100,
        width: 100,
        height: 30
    });

    const calls = [];
    options.beforeInstall?.(window.document);
    // With a real engine the install uses its own export actions, which is what
    // the busy-state behaviour is about; otherwise record the calls.
    const stubActions = options.engine ? {} : {
        copyLink: async () => calls.push('copy'),
        exportMarkdown: () => calls.push('markdown'),
        exportPdf: () => calls.push('pdf')
    };
    userscriptUi.install({
        document: window.document,
        engine: options.engine || {},
        launcherDelay: 0,
        syncInterval: 0,
        ...stubActions
    });
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    return { dom, window, calls };
}

test('userscript integrates Markdown and PDF actions into ChatGPT conversation menus', () => {
    const { window, calls } = installUserscriptUi();
    const menu = window.document.querySelector('#conversation-menu');
    const labels = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(item => item.textContent.trim());

    assert.deepEqual(labels, ['Share', 'Export to Markdown', 'Export to PDF', 'Rename']);
    assert.equal(window.document.querySelector('#chatgpt-export-markdown-btn'), null);
    assert.equal(window.document.querySelector('#chatgpt-export-pdf-btn'), null);

    menu.querySelector('[data-chat-exporter-item="markdown"]').click();
    menu.querySelector('[data-chat-exporter-item="pdf"]').click();
    assert.deepEqual(calls, ['markdown', 'pdf']);
});

test('userscript injects into a previously mounted menu when ChatGPT reveals it', async () => {
    const { window } = installUserscriptUi();
    const menu = window.document.createElement('div');
    menu.id = 'lazy-conversation-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.innerHTML = '<button id="native-share" role="menuitem" aria-haspopup="dialog" aria-controls="share-dialog"><span>Share</span></button>';
    menu.getClientRects = () => menu.hidden ? [] : [{ width: 100, height: 30 }];
    window.document.body.appendChild(menu);
    await new Promise(resolve => window.setTimeout(resolve, 0));

    assert.equal(menu.querySelector('[data-chat-exporter-item]'), null);
    menu.hidden = false;
    await new Promise(resolve => window.setTimeout(resolve, 0));

    const exportItems = Array.from(menu.querySelectorAll('[data-chat-exporter-item]'));
    assert.deepEqual(exportItems.map(item => item.textContent), ['Export to Markdown', 'Export to PDF']);
    assert.ok(exportItems.every(item => !item.id && !item.hasAttribute('aria-controls') && !item.hasAttribute('aria-haspopup')));
    assert.equal(window.document.querySelectorAll('#native-share').length, 1);
});

test('userscript turns the header Share into a menu with native share, copy, Markdown, and PDF', async () => {
    const { window, calls } = installUserscriptUi();
    window.document.querySelector('#header-share').click();

    const menu = window.document.querySelector('#chat-exporter-share-menu');
    assert.ok(menu);
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    assert.deepEqual(items.map(item => item.textContent), ['Share…', 'Copy link', 'Export to Markdown', 'Export to PDF']);

    items[1].click();
    await Promise.resolve();
    assert.deepEqual(calls, ['copy']);

    window.document.body.click();
    window.document.querySelector('#header-share').click();
    window.document.querySelector('#chat-exporter-share-menu [role="menuitem"]:nth-child(3)').click();
    assert.deepEqual(calls, ['copy', 'markdown']);

    window.document.querySelector('#header-share').click();
    window.document.querySelector('#chat-exporter-share-menu [role="menuitem"]:nth-child(4)').click();
    assert.deepEqual(calls, ['copy', 'markdown', 'pdf']);
});

test('userscript Share… item passes the click through to ChatGPT\'s native share', () => {
    const { window } = installUserscriptUi();
    const shareButton = window.document.querySelector('#header-share');
    let nativeClicks = 0;
    shareButton.addEventListener('click', () => {
        nativeClicks += 1;
    });

    shareButton.click();
    assert.equal(nativeClicks, 0, 'intercepted click must not reach the native handler');
    assert.ok(window.document.querySelector('#chat-exporter-share-menu'));

    window.document.querySelector('#chat-exporter-share-menu [role="menuitem"]').click();
    assert.equal(nativeClicks, 1, 'Share… must re-click the native button unintercepted');
    assert.equal(window.document.querySelector('#chat-exporter-share-menu'), null);
});

test('userscript finds the header share button by data-testid regardless of locale', () => {
    const { window } = installUserscriptUi();
    const localized = window.document.createElement('button');
    localized.id = 'localized-share';
    localized.setAttribute('data-testid', 'share-chat-button');
    localized.innerHTML = '<span>Compartir</span>';
    window.document.body.appendChild(localized);

    localized.click();
    assert.ok(window.document.querySelector('#chat-exporter-share-menu'),
        'share menu should open from the localized button via its data-testid');
    window.document.body.click();
});

// Live ChatGPT (observed 2026-08-05): the header carries
// `share-chat-button` next to `conversation-options-button`, while every user
// turn carries its own `share-prompt-link-turn-action-button`.
const LIVE_CHATGPT_FIXTURE = `<!DOCTYPE html>
<html>
<body>
    <header>
        <div data-testid="thread-header-right-actions">
            <button data-testid="share-chat-button"><span>Share</span></button>
            <button data-testid="conversation-options-button"><span>More</span></button>
        </div>
    </header>
    <main>
        <section data-testid="conversation-turn-1">
            <div data-message-author-role="user"><div class="markdown"><p>Hello</p></div></div>
            <button data-testid="share-prompt-link-turn-action-button" aria-label="Share prompt"></button>
        </section>
        <section data-testid="conversation-turn-2">
            <div data-message-author-role="assistant"><div class="markdown"><p>Hi there</p></div></div>
        </section>
    </main>
</body>
</html>`;

// Live ChatGPT hides the conversation menu's Share row on wide viewports
// (class "sm:hidden") because the header Share button takes over there.
const HIDDEN_SHARE_MENU_FIXTURE = `<!DOCTYPE html>
<html>
<body>
    <header>
        <button data-testid="share-chat-button"><span>Share</span></button>
        <div id="menu-trigger" aria-haspopup="menu" aria-expanded="true">More</div>
    </header>
    <div id="conversation-menu" role="menu" aria-labelledby="menu-trigger" data-radix-menu-content>
        <div role="menuitem" class="__menu-item sm:hidden" data-testid="share-chat-menu-item"><svg class="icon"></svg><span>Share</span></div>
        <div role="menuitem" class="__menu-item"><svg class="icon"></svg><span>View files in chat</span></div>
        <div role="menuitem" class="__menu-item"><svg class="icon"></svg><span>Archive</span></div>
        <div role="menuitem" class="__menu-item" data-testid="delete-chat-menu-item"><svg class="icon"></svg><span>Delete</span></div>
    </div>
    <div data-message-author-role="user"><div class="markdown"><p>Hello</p></div></div>
</body>
</html>`;

function hideElement(element) {
    element.getClientRects = () => [];
}

test('export items reach a conversation menu whose Share row is hidden on desktop', () => {
    const { window, calls } = installUserscriptUi({
        markup: HIDDEN_SHARE_MENU_FIXTURE,
        beforeInstall: doc => hideElement(doc.querySelector('[data-testid="share-chat-menu-item"]'))
    });

    const menu = window.document.querySelector('#conversation-menu');
    const labels = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(item => item.textContent.trim());
    assert.deepEqual(labels, ['Share', 'Export to Markdown', 'Export to PDF', 'View files in chat', 'Archive', 'Delete']);

    const clones = Array.from(menu.querySelectorAll('[data-chat-exporter-item]'));
    assert.ok(clones.every(clone => !clone.className.includes('sm:hidden')),
        'clones must come from a row that renders, not from the hidden Share entry');
    assert.ok(clones.every(clone => clone.querySelector('svg')?.getAttribute('viewBox') === '0 0 24 24'),
        'cloned rows carry our glyph inside ChatGPT\'s own svg element');

    clones[0].click();
    clones[1].click();
    assert.deepEqual(calls, ['markdown', 'pdf']);
});

test('sidebar conversation menus are left alone', () => {
    const { window } = installUserscriptUi({
        markup: `<!DOCTYPE html>
<html>
<body>
    <nav>
        <a href="/c/other-conversation">Another chat</a>
        <div id="sidebar-trigger" aria-haspopup="menu" aria-expanded="true">More</div>
    </nav>
    <div id="sidebar-menu" role="menu" aria-labelledby="sidebar-trigger">
        <div role="menuitem" data-testid="share-chat-menu-item"><span>Share</span></div>
        <div role="menuitem" data-testid="delete-chat-menu-item"><span>Delete</span></div>
    </div>
    <div data-message-author-role="user"><div class="markdown"><p>Hello</p></div></div>
</body>
</html>`
    });

    assert.equal(window.document.querySelector('[data-chat-exporter-item]'), null,
        'a sidebar row\'s menu would export the open conversation, not its own');
});

test('per-turn share buttons keep their native behaviour', () => {
    const { window } = installUserscriptUi({ markup: LIVE_CHATGPT_FIXTURE });
    const turnShare = window.document.querySelector('[data-testid="share-prompt-link-turn-action-button"]');
    let nativeClicks = 0;
    turnShare.addEventListener('click', () => {
        nativeClicks += 1;
    });

    turnShare.click();
    assert.equal(nativeClicks, 1, '"Share prompt" shares that message, not the conversation — never intercept it');
    assert.equal(window.document.querySelector('#chat-exporter-share-menu'), null);

    window.document.querySelector('[data-testid="share-chat-button"]').click();
    assert.ok(window.document.querySelector('#chat-exporter-share-menu'),
        'the header share button still opens the export menu');
});

test('per-turn share buttons do not count as a native share control', async () => {
    const { window } = installUserscriptUi({ markup: LIVE_CHATGPT_FIXTURE });
    window.document.querySelector('[data-testid="share-chat-button"]').remove();
    window.document.body.appendChild(window.document.createElement('span'));
    await new Promise(resolve => window.setTimeout(resolve, 0));

    assert.ok(window.document.querySelector('#chat-exporter-launcher'),
        'a turn-level share button must not suppress the launcher');
});

test('userscript mounts a floating launcher when the account exposes no share control (issue #31)', () => {
    const { window, calls } = installUserscriptUi({ markup: NO_SHARE_UI_FIXTURE });
    const launcher = window.document.querySelector('#chat-exporter-launcher');

    assert.ok(launcher, 'accounts without a share control still need an export entry point');
    assert.notEqual(launcher.style.display, 'none');

    launcher.click();
    const menu = window.document.querySelector('#chat-exporter-share-menu');
    assert.ok(menu, 'the launcher opens the export menu');
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    assert.deepEqual(items.map(item => item.textContent), ['Copy link', 'Export to Markdown', 'Export to PDF'],
        'Share… is omitted when there is no native share dialog to hand off to');

    items[1].click();
    assert.deepEqual(calls, ['markdown']);
    assert.equal(window.document.querySelector('#chat-exporter-share-menu'), null);
});

test('userscript launcher toggles its menu closed on a second click', () => {
    const { window } = installUserscriptUi({ markup: NO_SHARE_UI_FIXTURE });
    const launcher = window.document.querySelector('#chat-exporter-launcher');

    launcher.click();
    assert.ok(window.document.querySelector('#chat-exporter-share-menu'));
    launcher.click();
    assert.equal(window.document.querySelector('#chat-exporter-share-menu'), null);
});

test('userscript keeps the launcher hidden while ChatGPT shows its own share control', async () => {
    const { window } = installUserscriptUi();
    assert.equal(window.document.querySelector('#chat-exporter-launcher'), null,
        'the native menus are enough while a share control exists');

    window.document.querySelector('#header-share').remove();
    window.document.querySelector('#conversation-menu').remove();
    await new Promise(resolve => window.setTimeout(resolve, 0));

    const launcher = window.document.querySelector('#chat-exporter-launcher');
    assert.ok(launcher, 'the launcher appears once the share control disappears');

    const restored = window.document.createElement('button');
    restored.setAttribute('data-testid', 'share-chat-button');
    restored.appendChild(window.document.createTextNode('Compartir'));
    window.document.body.appendChild(restored);
    await new Promise(resolve => window.setTimeout(resolve, 0));

    assert.equal(launcher.style.display, 'none', 'the launcher steps aside when the native control returns');
});

test('userscript builds menu icons without innerHTML so strict CSP pages keep working', () => {
    const { window } = installUserscriptUi({ markup: NO_SHARE_UI_FIXTURE });
    const launcher = window.document.querySelector('#chat-exporter-launcher');

    assert.ok(launcher.querySelector('svg'), 'the launcher renders a parsed SVG icon');
    launcher.click();
    const icons = window.document.querySelectorAll('#chat-exporter-share-menu [role="menuitem"] svg');
    assert.equal(icons.length, 3);
    assert.ok(Array.from(icons).every(icon => icon.namespaceURI === 'http://www.w3.org/2000/svg'));
});

test('cloned conversation-menu items are relabelled and drop ChatGPT test ids', () => {
    // A localized menu: the share item is found by data-testid, and its label
    // must still be replaced rather than repeated three times.
    const { window } = installUserscriptUi({ markup: `<!DOCTYPE html>
<html>
<body>
    <div id="conversation-menu" role="menu">
        <button role="menuitem" data-testid="share-chat-menu-item"><span data-testid="share-label">Compartir</span></button>
    </div>
</body>
</html>` });

    const clones = Array.from(window.document.querySelectorAll('[data-chat-exporter-item]'));
    assert.deepEqual(clones.map(item => item.textContent), ['Export to Markdown', 'Export to PDF']);
    assert.equal(window.document.querySelectorAll('[data-testid="share-chat-menu-item"]').length, 1);
    assert.equal(window.document.querySelectorAll('[data-testid="share-label"]').length, 1);
});

test('a running export says so and refuses to start a second sweep', async () => {
    let started = 0;
    let release;
    const engineStub = {
        exportConversationFull: () => {
            started += 1;
            return new Promise(resolve => { release = resolve; });
        }
    };
    const { window } = installUserscriptUi({ markup: NO_SHARE_UI_FIXTURE, engine: engineStub });

    const launcher = window.document.querySelector('#chat-exporter-launcher');
    const clickExport = async () => {
        launcher.click();
        window.document.querySelector('#chat-exporter-share-menu [role="menuitem"]:nth-child(2)').click();
        await new Promise(resolve => window.setTimeout(resolve, 0));
    };

    await clickExport();
    assert.equal(started, 1);
    assert.equal(launcher.querySelector('span').textContent, 'Exporting…', 'the launcher shows the sweep is running');

    await clickExport();
    assert.equal(started, 1, 'a second click does not start a competing sweep');

    release({});
    await new Promise(resolve => window.setTimeout(resolve, 0));
    assert.equal(launcher.querySelector('span').textContent, 'Export', 'the label goes back when the export finishes');
});

test('userscript exposes a console fallback for exporting', () => {
    const { window, calls } = installUserscriptUi({ markup: NO_SHARE_UI_FIXTURE });

    assert.equal(typeof window.ChatExporter.markdown, 'function');
    window.ChatExporter.markdown();
    window.ChatExporter.pdf();
    assert.deepEqual(calls, ['markdown', 'pdf']);
});

test('userscript leaves an empty chat page alone until it has messages', async () => {
    const { window } = installUserscriptUi({ markup: `<!DOCTYPE html>
<html><body><header><button id="new-chat"><span>New chat</span></button></header></body></html>` });

    assert.equal(window.document.querySelector('#chat-exporter-launcher'), null,
        'nothing to export yet, so no launcher');

    const message = window.document.createElement('div');
    message.setAttribute('data-message-author-role', 'user');
    window.document.body.appendChild(message);
    await new Promise(resolve => window.setTimeout(resolve, 0));

    assert.ok(window.document.querySelector('#chat-exporter-launcher'),
        'the launcher appears as soon as the conversation has messages');
});

test('ChatExporter.showLauncher() forces the launcher on even next to a native share control', async () => {
    const { window } = installUserscriptUi();
    assert.equal(window.document.querySelector('#chat-exporter-launcher'), null);

    const launcher = window.ChatExporter.showLauncher();
    assert.ok(launcher);

    window.document.body.appendChild(window.document.createElement('span'));
    await new Promise(resolve => window.setTimeout(resolve, 0));
    assert.notEqual(window.document.querySelector('#chat-exporter-launcher').style.display, 'none',
        'a forced launcher survives later DOM churn');
});

// An enterprise-style page: a real conversation, but no share control anywhere
// because the account has sharing disabled by policy.
const ENTERPRISE_PAGE = `<!DOCTYPE html>
<html>
<head><title>Enterprise Conversation</title></head>
<body>
    <header><button id="new-chat"><span>New chat</span></button></header>
    <main>
        <div data-message-author-role="user"><p>Does the export button still work here?</p></div>
        <div data-message-author-role="assistant"><p>It should, through the floating launcher.</p></div>
    </main>
</body>
</html>`;

async function runUserscript(html, options = {}) {
    const dom = new JSDOM(html, {
        url: 'https://chatgpt.com/c/enterprise-fixture',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });

    const { window } = dom;
    installInnerText(window);
    window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
    window.HTMLElement.prototype.getBoundingClientRect = () => ({
        top: 10, right: 200, bottom: 40, left: 100, width: 100, height: 30
    });

    const downloads = [];
    window.URL.createObjectURL = blob => {
        downloads.push({ blob, filename: null });
        return `blob:download-${downloads.length}`;
    };
    window.URL.revokeObjectURL = () => {};
    window.alert = () => {};
    window.console = console;
    window.HTMLAnchorElement.prototype.click = function click() {
        const latest = downloads[downloads.length - 1];
        if (latest) latest.filename = this.download;
    };

    // Pages that enforce `require-trusted-types-for 'script'` turn every HTML
    // sink into a throwing setter; the userscript must never touch one.
    if (options.trustedTypes) {
        const blocked = () => {
            throw new TypeError("This document requires 'TrustedHTML' assignment.");
        };
        Object.defineProperty(window.Element.prototype, 'innerHTML', { set: blocked, get: () => '' });
        Object.defineProperty(window.Element.prototype, 'outerHTML', { set: blocked, get: () => '' });
        window.Element.prototype.insertAdjacentHTML = blocked;
        window.document.write = blocked;
    }

    window.eval(readScript(options.script || 'chatgpt-markdown-exporter.user.js'));

    // The launcher waits for ChatGPT's header to settle before deciding that no
    // native share control exists.
    const deadline = Date.now() + 5000;
    let launcher = null;
    while (!launcher && Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 50));
        launcher = window.document.querySelector('#chat-exporter-launcher');
    }
    return { window, downloads, launcher };
}

async function exportFromLauncher(window, launcher, downloads) {
    launcher.click();
    window.document.querySelector('#chat-exporter-share-menu [role="menuitem"]:nth-child(2)').click();
    const deadline = Date.now() + 5000;
    while (downloads.length === 0 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

test('built userscript exports end to end on an account with no share control (issue #31)', async () => {
    const { window, downloads, launcher } = await runUserscript(ENTERPRISE_PAGE);
    assert.ok(launcher, 'the userscript must expose an export control without ChatGPT sharing');

    await exportFromLauncher(window, launcher, downloads);

    assert.equal(downloads.length, 1, 'clicking Export to Markdown downloads the conversation');
    const content = await downloads[0].blob.text();
    assert.match(content, /Does the export button still work here\?/);
    assert.match(content, /It should, through the floating launcher\./);
    assert.match(downloads[0].filename, /\.md$/);
});

test('built userscript installs and exports on a page that enforces Trusted Types', async () => {
    const { window, downloads, launcher } = await runUserscript(ENTERPRISE_PAGE, { trustedTypes: true });
    assert.ok(launcher, 'strict CSP must not stop the export UI from mounting');

    await exportFromLauncher(window, launcher, downloads);

    assert.equal(downloads.length, 1);
    assert.match(await downloads[0].blob.text(), /Does the export button still work here\?/);
});

test('ChatGPT markdown exporter preserves CodeMirror code, MathJax, tables, links, and media', async () => {
    const { content } = await runExporter('exporter-markdown.js', chatGptFixture());

    assert.match(content, /```javascript\nfunction hi\(\) \{\n  return "ok";\n\}\n```/);
    assert.match(content, /\$\\mu\$/);
    assert.match(content, /\$\$f\(x \\mid \\mu\)\$\$/);
    assert.match(content, /\| Name \| Value \|/);
    assert.match(content, /\| alpha \| 1 \|/);
    assert.match(content, /\[Example \\\[link\\\]\]\(https:\/\/example\.com\/a%29b\)/);
    assert.match(content, /\[Image: plot\]/);
    assert.doesNotMatch(content, /\\\\mu/);
});

test('markdown export preserves prompt line breaks and never doubles backslashes (issue #25)', async () => {
    const { content } = await runExporter('exporter-markdown.js', issue25Fixture());

    // User prompt: newlines, blank lines, and indentation survive verbatim.
    assert.ok(content.includes('What is \\n ?\nShow me a 5-line example.\n\nMake no mistakes.\n    return indented;'),
        `pre-wrap prompt should keep its line structure, got:\n${content}`);

    // Inline code keeps backslashes verbatim.
    assert.ok(content.includes('`\\n` is the **newline character**'));
    assert.equal(content.includes('\\\\n'), false, 'backslashes must not be doubled anywhere');

    // Inline code containing backticks uses a longer delimiter, not fake escapes.
    assert.ok(content.includes('``a`b``'));
    assert.equal(content.includes('\\`'), false);

    // Code blocks built from <br>-separated lines keep one line per line.
    assert.match(content, /```\nLine 1\nLine 2\nLine 3\n```/);

    // Literal entity text is not un-escaped into different characters.
    assert.ok(content.includes('Escape &amp; as `&amp;`'));
    assert.ok(content.includes('&lt;div&gt; stays literal'));

    // Table cells escape pipes but leave backslashes alone.
    assert.ok(content.includes('| \\n | C:\\temp \\| D:\\data |'));
});

test('shared engine preserves pre-wrap prompts routed through inline styles', () => {
    const dom = new JSDOM(`<!DOCTYPE html>
<html><head><title>Styled fixture</title></head><body><main>
    <div data-message-author-role="user">
        <div style="white-space: pre-wrap">first line
second line</div>
    </div>
    <div data-message-author-role="assistant"><p>Understood, exporting both lines now.</p></div>
</main></body></html>`, { url: 'https://chatgpt.com/c/styled' });

    const result = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });

    assert.equal(result.messages[0].content, 'first line\nsecond line');
});

test('image-only turns keep embedded media and turn-level metadata (issues #32, #33)', () => {
    const dom = new JSDOM(issue32And33Fixture(), {
        url: 'https://chatgpt.com/c/attachment-metadata'
    });
    installInnerText(dom.window);

    const markdownConversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });

    assert.equal(markdownConversation.messages.length, 2, 'an image-only user turn must not be rejected as empty');
    assert.equal(markdownConversation.messages[0].sender, 'You');
    assert.match(markdownConversation.messages[0].content, /!\[uploaded-sketch\.png\]\(data:image\/png;base64,/);
    assert.match(markdownConversation.messages[0].content, /\[File: Uploaded_Filename\.zip\]/);
    assert.equal(markdownConversation.messages[0].timestamp, 'Tue, Jun 9 at 12:47 PM');
    assert.equal(markdownConversation.messages[0].timestampIso, '2026-06-09T18:47:00.000Z');

    const assistant = markdownConversation.messages[1];
    assert.match(assistant.content, /\[File: ABC Workbook\]\(sandbox:\/mnt\/data\/ABC_Workbook\.xlsx\)/);
    assert.match(assistant.content, /Checked the formulas before saving\./);
    assert.equal(assistant.timestamp, 'Tue, Jun 9 at 12:48 PM');

    const rendered = engine.serializers.markdown(markdownConversation);
    assert.match(rendered, /### \*\*You\*\* · Tue, Jun 9 at 12:47 PM/);
    assert.equal((rendered.match(/Tue, Jun 9 at 12:47 PM/g) || []).length, 1,
        'turn timestamps are metadata, not duplicated in message content');

    const htmlConversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'html'
    });
    assert.match(htmlConversation.messages[0].content, /<img class="exported-media" src="data:image\/png;base64,/);
    assert.match(engine.serializers.html(htmlConversation), /<time datetime="2026-06-09T18:47:00\.000Z">Tue, Jun 9 at 12:47 PM<\/time>/);
});

test('built Markdown exporter captures an image-only turn end to end (issue #33)', async () => {
    const { content } = await runExporter('exporter-markdown.js', issue32And33Fixture());

    assert.match(content, /### \*\*You\*\* · Tue, Jun 9 at 12:47 PM/);
    assert.match(content, /!\[uploaded-sketch\.png\]\(data:image\/png;base64,/);
    assert.match(content, /\[File: Uploaded_Filename\.zip\]/);
    assert.match(content, /\[File: ABC Workbook\]\(sandbox:\/mnt\/data\/ABC_Workbook\.xlsx\)/);
});

test('ChatGPT payload enrichment adds timestamps, attachments, generated files, and visible reasoning (issue #32)', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><head><title>Payload Fixture</title></head><body><main>
        <div data-message-author-role="user" data-message-id="message-user-api"><p>Review the uploaded diagram please.</p></div>
        <div data-message-author-role="assistant" data-message-id="message-assistant-api"><p>Created the workbook.</p></div>
    </main></body></html>`, {
        url: 'https://chatgpt.com/c/conversation-api'
    });
    installInnerText(dom.window);

    const requested = [];
    dom.window.fetch = async input => {
        const url = String(input);
        requested.push(url);
        if (url.includes('/backend-api/conversation/conversation-api')) {
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => chatGptConversationPayload()
            };
        }
        if (url.includes('/backend-api/files/download/file-image-api')) {
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'image/png' },
                arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer
            };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const conversation = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scroll: false,
        awaitStreaming: false
    });

    assert.equal(conversation.messages.length, 2);
    assert.equal(conversation.messages[0].timestampIso, new Date(1781030820 * 1000).toISOString());
    assert.ok(conversation.messages[0].timestamp, 'a localized per-turn timestamp is rendered');
    assert.match(conversation.messages[0].content, /!\[uploaded-diagram\.png\]\(data:image\/png;base64,iVBORw==\)/);

    assert.equal(conversation.messages[1].timestampIso, new Date(1781030880 * 1000).toISOString());
    assert.match(conversation.messages[1].content, /\[File: ABC_Workbook\.xlsx\]\(sandbox:\/mnt\/data\/ABC_Workbook\.xlsx\)/);
    assert.match(conversation.messages[1].content, /\*\*Reasoning:\*\* Checked workbook formulas and output paths\./);
    assert.ok(requested.some(url => url.includes('/backend-api/files/download/file-image-api')),
        'image bytes are embedded from the authenticated file endpoint');
});

test('ChatGPT metadata enrichment is bounded and never blocks the DOM export', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><head><title>Metadata Timeout</title></head><body><main>
        <div data-message-author-role="user" data-message-id="message-timeout-user"><p>Keep this prompt even if metadata stalls.</p></div>
        <div data-message-author-role="assistant" data-message-id="message-timeout-assistant"><p>Keep this response too.</p></div>
    </main></body></html>`, {
        url: 'https://chatgpt.com/c/metadata-timeout'
    });

    dom.window.fetch = (input, init = {}) => new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });

    const started = Date.now();
    const conversation = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scroll: false,
        awaitStreaming: false,
        metadataMaxDuration: 25
    });

    assert.ok(Date.now() - started < 1000, 'metadata uses its own short wall-clock budget');
    assert.equal(conversation.messages.length, 2);
    assert.match(conversation.messages[0].content, /Keep this prompt/);
    assert.match(conversation.messages[1].content, /Keep this response/);
});

test('exports omit exact source URLs by default while keeping provider labels', async () => {
    const sourceUrl = 'https://chatgpt.com/c/private-share?model=gpt-5';
    const markdown = await runExporter('exporter-markdown.js', chatGptFixture(), sourceUrl);
    const html = await runExporter('exporter-html.js', chatGptFixture(), sourceUrl);
    const pdfReady = await runExporter('exporter-pdf.js', chatGptFixture(), sourceUrl);

    assert.equal(markdown.content.includes(sourceUrl), false);
    assert.match(markdown.content, /\*\*Source:\*\* chatgpt\.com/);
    assert.doesNotMatch(markdown.content, /\*\*Source:\*\* \[chatgpt\.com\]\(/);

    assert.equal(html.content.includes(sourceUrl), false);
    assert.match(html.content, /<strong>Source:<\/strong> chatgpt\.com/);

    assert.equal(pdfReady.content.includes(sourceUrl), false);
    assert.match(pdfReady.content, /<strong>Source:<\/strong> chatgpt\.com/);
});

test('shared engine includes exact source URL only when explicitly requested', () => {
    const sourceUrl = 'https://chatgpt.com/c/private-share?model=gpt-5';
    const dom = new JSDOM(chatGptFixture(), { url: sourceUrl });
    installInnerText(dom.window);

    const defaultConversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });
    const defaultMarkdown = engine.serializers.markdown(defaultConversation);

    assert.equal(defaultConversation.sourceUrl, '');
    assert.equal(defaultMarkdown.includes(sourceUrl), false);
    assert.match(defaultMarkdown, /\*\*Source:\*\* chatgpt\.com/);

    const optInConversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        includeSourceUrl: true
    });
    const optInMarkdown = engine.serializers.markdown(optInConversation);

    assert.equal(optInConversation.sourceUrl, sourceUrl);
    assert.equal(optInMarkdown.includes(`**Source:** [chatgpt.com](${sourceUrl})`), true);
});

test('Markdown code blocks use sanitized info strings and fences longer than code content', async () => {
    const { content } = await runExporter('exporter-markdown.js', fenceInjectionFixture());

    assert.match(content, /````javascriptbad\nconst start = "ok";\n```\nconst done = true;\n````/);
    assert.doesNotMatch(content, /```javascript ``` bad/);
});

test('shared engine serializes live-observed ChatGPT shapes from synthetic fixture', () => {
    const dom = new JSDOM(readFixture('chatgpt-live-shapes.html'), {
        url: 'https://chatgpt.com/c/live-shapes'
    });

    const result = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });

    assert.equal(result.provider, 'chatgpt');
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[0].sender, 'You');
    assert.equal(result.messages[1].sender, 'ChatGPT');

    const content = result.messages[1].content;
    assert.match(content, /## Audit Heading/);
    assert.match(content, /\*\*Bold\*\*/);
    assert.match(content, /\*italic\*/);
    assert.match(content, /\$\\sigma\^2\$/);
    assert.match(content, /\$\$y=x\^2\$\$/);
    assert.match(content, /```typescript\nconst value = 1;\nconsole\.log\(value\);\n```/);
    assert.match(content, /\| Feature \| Status \| Notes \|/);
    assert.match(content, /- Parent item/);
    assert.match(content, /\n  - Child item/);
    assert.match(content, /> Quoted synthetic result\./);
    assert.match(content, /\[Doc \\\[A\\\]\]\(https:\/\/example\.com\/a%29b\)/);
    assert.match(content, /\[File: sample-report\.csv\]/);
    assert.match(content, /\[Artifact: audit-notes\.md\]/);
    assert.match(content, /\[Image: synthetic chart\]/);
});

test('ChatGPT HTML exporter restores structured code and table markup', async () => {
    const { content } = await runExporter('exporter-html.js', chatGptFixture());

    assert.match(content, /<pre><code class="language-javascript">function hi\(\) \{\n  return &quot;ok&quot;;\n\}<\/code><\/pre>/);
    assert.doesNotMatch(content, /&lt;pre&gt;&lt;code&gt;/);
    assert.match(content, /<table><tr><th>Name<\/th><th>Value<\/th><\/tr><tr><td>alpha<\/td><td>1<\/td><\/tr><\/table>/);
    assert.match(content, /\$\\mu\$/);
});

test('ChatGPT PDF-ready exporter keeps printable code and table elements', async () => {
    const { content } = await runExporter('exporter-pdf.js', chatGptFixture());

    assert.match(content, /<pre class="code-block"><div class="code-language">javascript<\/div><code>function hi\(\) \{\n  return &quot;ok&quot;;\n\}<\/code><\/pre>/);
    assert.match(content, /<table><tr><th>Name<\/th><th>Value<\/th><\/tr><tr><td>alpha<\/td><td>1<\/td><\/tr><\/table>/);
    assert.doesNotMatch(content, /\[CODE\]/);
});

test('Gemini markdown exporter uses current selectors and rich content extraction', async () => {
    const { content } = await runExporter(
        'gemini-exporter-markdown.js',
        geminiFixture(),
        'https://gemini.google.com/app/test-fixture'
    );

    assert.match(content, /### \*\*You\*\*/);
    assert.match(content, /### \*\*Gemini\*\*/);
    assert.match(content, /```python\nprint\("hello"\)\nprint\("world"\)\n```/);
    assert.match(content, /\| Tool \| Status \|/);
    assert.match(content, /\[Gemini home\]\(https:\/\/gemini\.google\.com\/\)/);
    assert.match(content, /\[Canvas or chart\]/);
});

test('shared engine serializes live-observed Gemini custom elements from synthetic fixture', () => {
    const dom = new JSDOM(readFixture('gemini-live-shapes.html'), {
        url: 'https://gemini.google.com/app/live-shapes'
    });

    const result = engine.extractConversation({
        document: dom.window.document,
        provider: 'gemini',
        format: 'markdown'
    });

    assert.equal(result.provider, 'gemini');
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[0].sender, 'You');
    assert.equal(result.messages[1].sender, 'Gemini');

    const content = result.messages[1].content;
    assert.match(content, /## Gemini Audit/);
    assert.match(content, /```javascript\nfunction audit\(\) \{\n  return "gemini";\n\}\n```/);
    assert.match(content, /\| Provider \| Shape \| Status \|/);
    assert.match(content, /1\. First ordered item/);
    assert.match(content, /\[Gemini app\]\(https:\/\/gemini\.google\.com\/app\)/);
    assert.match(content, /\[Canvas or chart\]/);
    assert.match(content, /\[File: gemini-notes\.txt\]/);
});

function citationsFixture() {
    return `<!DOCTYPE html>
<html>
<head><title>Citations Fixture</title></head>
<body>
    <main>
        <div data-message-author-role="user">
            <p>Summarize the coverage and include your sources for everything please.</p>
        </div>
        <div data-message-author-role="assistant">
            <p>Recent reporting from
                <a href="https://news.example.com/story?utm_source=chatgpt.com" target="_blank">news.example.com</a>
                confirms the change, echoed in the paper below.
            </p>
            <div class="citation-list">
                <a href="https://research.example.org/paper">Deep Research Paper</a>
                <a href="https://news.example.com/story?utm_source=chatgpt.com">duplicate pill</a>
            </div>
            <p>Unrelated inline links like <a href="https://plain.example.net/docs">plain docs</a> stay inline-only.</p>
        </div>
    </main>
</body>
</html>`;
}

test('assistant citations are appended as a References list (issue #27)', () => {
    const dom = new JSDOM(citationsFixture(), { url: 'https://chatgpt.com/c/citations' });
    const result = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });

    const content = result.messages[1].content;
    assert.match(content, /\*\*References:\*\*/);
    assert.match(content, /1\. \[news\.example\.com\]\(https:\/\/news\.example\.com\/story\?utm_source=chatgpt\.com\)/);
    assert.match(content, /2\. \[Deep Research Paper\]\(https:\/\/research\.example\.org\/paper\)/);
    assert.equal(content.match(/news\.example\.com\/story/g).length, 3,
        'inline pill, duplicate pill inline, and one reference entry');
    assert.doesNotMatch(content, /3\. \[/);
    assert.doesNotMatch(content, /References:[\s\S]*plain\.example\.net/,
        'ordinary links must not be promoted to references');

    const userContent = result.messages[0].content;
    assert.doesNotMatch(userContent, /References:/);
});

test('citation references render as an ordered list in HTML exports', () => {
    const dom = new JSDOM(citationsFixture(), { url: 'https://chatgpt.com/c/citations' });
    const result = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'html'
    });

    const content = result.messages[1].content;
    assert.match(content, /<div class="references"><strong>References:<\/strong><ol>/);
    assert.match(content, /<li><a href="https:\/\/research\.example\.org\/paper">Deep Research Paper<\/a><\/li>/);
});

function installVirtualizedConversation(window, totalMessages, options = {}) {
    const { document } = window;
    const scroller = document.createElement('div');
    scroller.id = 'scroller';
    scroller.style.overflowY = 'auto';
    document.body.appendChild(scroller);

    const MESSAGE_HEIGHT = 100;
    // Steps of 0.75 * clientHeight overlap, so a narrow viewport is what makes
    // each stop show a fresh set of turns — as a long ChatGPT answer does.
    const CLIENT_HEIGHT = options.clientHeight || 300;
    let scrollTop = 0;

    let renders = 0;
    // Node identity survives being scrolled out of view, as it does in a real
    // virtualizer — content rendered once stays rendered.
    const nodes = new Map();
    const seenOnce = new Set();

    const nodeFor = i => {
        if (!nodes.has(i)) {
            const message = document.createElement('div');
            message.setAttribute('data-message-author-role', i % 2 === 0 ? 'user' : 'assistant');
            message.setAttribute('data-message-id', `msg-${i}`);
            const top = i * MESSAGE_HEIGHT;
            message.getBoundingClientRect = () => ({ top: top - scrollTop, bottom: top - scrollTop + MESSAGE_HEIGHT, height: MESSAGE_HEIGHT, left: 0, right: 100, width: 100 });
            nodes.set(i, message);
        }
        const message = nodes.get(i);

        const fill = () => {
            if (message.firstChild) return;
            const paragraph = document.createElement('p');
            paragraph.textContent = `Message number ${i} with enough body text to pass the export filters.`;
            message.appendChild(paragraph);
        };

        // ChatGPT mounts the turn container before its text renders, so a turn
        // scrolled into view is an empty shell for a moment and then fills in
        // where it stands — no further scrolling involved. The turns already on
        // screen when the export starts are rendered.
        if (options.mountLatency && i >= 3 && !seenOnce.has(i)) {
            seenOnce.add(i);
            window.setTimeout(fill, options.mountLatency);
            return message;
        }
        fill();
        return message;
    };

    const render = () => {
        renders += 1;
        while (scroller.firstChild) scroller.removeChild(scroller.firstChild);
        for (let i = 0; i < totalMessages; i++) {
            const top = i * MESSAGE_HEIGHT;
            const inWindow = top < scrollTop + CLIENT_HEIGHT && top + MESSAGE_HEIGHT > scrollTop;
            // ChatGPT leaves the turns from the previous scroll position mounted
            // for a moment after jumping to the top.
            const stale = options.staleBottomRenders
                && renders <= options.staleBottomRenders
                && i >= totalMessages - 3;
            if (!inWindow && !stale) continue;
            scroller.appendChild(nodeFor(i));
        }
    };

    Object.defineProperty(scroller, 'scrollHeight', { get: () => totalMessages * MESSAGE_HEIGHT, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { get: () => CLIENT_HEIGHT, configurable: true });
    // Real virtualizers swap rendered turns for shorter placeholders, which can
    // drag scrollTop backwards after a programmatic scroll (scroll anchoring).
    let writes = 0;
    Object.defineProperty(scroller, 'scrollTop', {
        get: () => scrollTop,
        set(value) {
            const clamped = Math.max(0, Math.min(value, totalMessages * MESSAGE_HEIGHT - CLIENT_HEIGHT));
            writes += 1;
            scrollTop = options.anchorJumpEvery && writes % options.anchorJumpEvery === 0
                ? Math.max(0, clamped - (options.anchorJumpBy || MESSAGE_HEIGHT * 2))
                : clamped;
            render();
        }
    });

    render();
    return scroller;
}

test('messages sharing a long opening are both kept', () => {
    // Dedupe used to key on the first 160 characters, so a conversation of
    // redrafts — every one opening with the same letter boilerplate — lost all
    // but the first, silently.
    const opening = 'Asunto: Solicitud de revision de calificacion. Estimados senores del comite academico, me dirijo a ustedes con el fin de solicitar formalmente la revision de la evaluacion correspondiente al periodo actual, conforme al reglamento vigente.';
    assert.ok(opening.length > 160);

    const dom = new JSDOM(`<!DOCTYPE html>
<html><head><title>Redrafts</title></head><body><main>
    <div data-message-author-role="user"><p>Draft the letter for me please</p></div>
    <div data-message-author-role="assistant"><p>${opening} Version one, please review the first paragraph.</p></div>
    <div data-message-author-role="user"><p>Rewrite the closing paragraph</p></div>
    <div data-message-author-role="assistant"><p>${opening} Version two, with the closing paragraph rewritten.</p></div>
</main></body></html>`, { url: 'https://chatgpt.com/c/redrafts' });

    const conversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });

    assert.equal(conversation.messages.length, 4, 'two answers with the same opening are different messages');
    assert.match(conversation.messages[1].content, /Version one/);
    assert.match(conversation.messages[3].content, /Version two/);
});

test('links whose scheme hides behind control characters are dropped', () => {
    const dom = new JSDOM(`<!DOCTYPE html>
<html><head><title>Scheme</title></head><body><main>
    <div data-message-author-role="user"><p>Check these links please</p></div>
    <div data-message-author-role="assistant"><p>
        <a href="java&#9;script:alert(1)">tabbed</a>
        <a href="java&#10;script:alert(2)">newlined</a>
        <a href=" JavaScript:alert(3)">spaced</a>
        <a href="https://example.com/safe">safe</a>
    </p></div>
</main></body></html>`, { url: 'https://chatgpt.com/c/scheme' });

    const conversation = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });
    const answer = conversation.messages[1].content;

    assert.doesNotMatch(answer, /script:/i, 'no scripting scheme survives as a link target');
    assert.match(answer, /\[safe\]\(https:\/\/example\.com\/safe\)/);
    ['tabbed', 'newlined', 'spaced'].forEach(label => {
        assert.match(answer, new RegExp(label), `${label} keeps its text`);
    });
});

test('full extraction retries turns that mount before their text renders', async () => {
    // Observed on live ChatGPT: an export contained turns 1, 6, 7, 8, 9, 10, 11,
    // 12 of 12. The sweep did reach every turn — but turns mounted empty on
    // first sight, and marking them "seen" before the capture succeeded retired
    // them permanently.
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Late Content Fixture</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/late-content',
        pretendToBeVisual: true
    });
    const totalMessages = 20;
    installVirtualizedConversation(dom.window, totalMessages, { mountLatency: 12, clientHeight: 200 });

    const full = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 10
    });

    assert.equal(full.messages.length, totalMessages, 'a turn seen empty must be retried, not dropped');
    const order = full.messages.map(message => Number(message.content.match(/Message number (\d+)/)[1]));
    assert.deepEqual(order, Array.from({ length: totalMessages }, (unused, index) => index));
});

test('full extraction keeps conversation order when the tail is still mounted', async () => {
    // Observed on live ChatGPT while exporting from the bottom of a 12-turn
    // chat: the first capture (taken at the top) also saw the last turns, which
    // the virtualizer had not unmounted yet, so the export came out as
    // 1, 2, 8, 9, 10, 11, 12, 3, 4, 5, 6, 7.
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Tail Fixture</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/tail',
        pretendToBeVisual: true
    });
    const totalMessages = 20;
    installVirtualizedConversation(dom.window, totalMessages, { staleBottomRenders: 4 });

    const full = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(full.messages.length, totalMessages);
    const order = full.messages.map(message => Number(message.content.match(/Message number (\d+)/)[1]));
    assert.deepEqual(order, Array.from({ length: totalMessages }, (unused, index) => index),
        'messages must be exported in conversation order, not in capture order');
    full.messages.forEach((message, index) => {
        assert.equal(message.index, index, 'indices are renumbered after sorting');
        assert.equal(message.sender, index % 2 === 0 ? 'You' : 'ChatGPT');
        assert.equal(Object.prototype.hasOwnProperty.call(message, 'order'), false,
            'the internal ordering key never reaches the export');
    });
});

test('full extraction survives a virtualizer that drags scrollTop backwards', async () => {
    // Observed on live ChatGPT: a sweep ended after the first screenful and
    // exported 6 of the conversation's 12 turns, because the step that swapped
    // rendered turns for placeholders left scrollTop lower than where it
    // started, which the old sweep read as "bottom reached".
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Anchored Fixture</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/anchored',
        pretendToBeVisual: true
    });
    const totalMessages = 30;
    installVirtualizedConversation(dom.window, totalMessages, { anchorJumpEvery: 3, anchorJumpBy: 260 });

    const full = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(full.messages.length, totalMessages,
        'every turn is captured even when the container scrolls back on its own');
    full.messages.forEach((message, index) => {
        assert.match(message.content, new RegExp(`Message number ${index}\\b`), `message ${index} is in order`);
    });
});

test('full extraction sweeps virtualized conversations end to end (issues #28, #29)', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Virtualized Fixture</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/virtualized',
        pretendToBeVisual: true
    });
    const totalMessages = 30;
    installVirtualizedConversation(dom.window, totalMessages);

    const truncated = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });
    assert.ok(truncated.messages.length < totalMessages,
        'single-pass extraction only sees the rendered window');

    const full = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(full.messages.length, totalMessages);
    full.messages.forEach((message, index) => {
        assert.match(message.content, new RegExp(`Message number ${index} `),
            'messages must stay in conversation order');
        assert.equal(message.senderType, index % 2 === 0 ? 'user' : 'assistant');
        assert.equal(message.reliableSender, true);
    });
});

test('a sweep cannot run forever, and says so when it gives up', async () => {
    // A provider whose container never stops growing would hold the page for as
    // long as the step budget allows.
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Endless</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/endless',
        pretendToBeVisual: true
    });
    const scroller = installVirtualizedConversation(dom.window, 40);
    let growth = 0;
    Object.defineProperty(scroller, 'scrollHeight', { get: () => 4000 + (growth += 100), configurable: true });

    const started = Date.now();
    const conversation = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 1,
        maxDuration: 250
    });

    assert.ok(Date.now() - started < 5000, 'the sweep honours its wall-clock budget');
    assert.equal(conversation.complete, false, 'an export cut short is reported as incomplete');
});

test('an export that never read every turn is flagged and announced', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Stuck</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/stuck',
        pretendToBeVisual: true
    });
    installVirtualizedConversation(dom.window, 12);
    const { window } = dom;
    installInnerText(window);

    // One turn never renders its text, however long the sweep waits. It lives
    // outside the scroller so the fixture's re-render cannot sweep it away.
    const stuck = window.document.createElement('div');
    stuck.setAttribute('data-message-author-role', 'assistant');
    stuck.setAttribute('data-message-id', 'msg-stuck');
    window.document.body.appendChild(stuck);

    const alerts = [];
    window.alert = message => alerts.push(message);
    window.URL.createObjectURL = () => 'blob:x';
    window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function click() {};

    const result = await engine.exportConversationFull({
        document: window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(result.conversation.complete, false);
    assert.ok(result.conversation.missedMessages >= 1, 'the unread turn is counted');
    assert.equal(alerts.length, 1, 'the reader is told the file may be short');
    assert.match(alerts[0], /may be incomplete/);
    assert.ok(result.conversation.messages.length >= 12, 'everything readable is still exported');
});

test('the reader gets their scroll position back even when a sweep throws', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Boom</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/boom',
        pretendToBeVisual: true
    });
    const scroller = installVirtualizedConversation(dom.window, 20);
    scroller.scrollTop = 900;
    const parked = scroller.scrollTop;

    let reads = 0;
    Object.defineProperty(scroller, 'clientHeight', {
        get() {
            if (++reads > 4) throw new Error('container went away mid-sweep');
            return 300;
        },
        configurable: true
    });

    await assert.rejects(() => engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    }), /went away mid-sweep/);

    assert.equal(scroller.scrollTop, parked, 'the conversation is left where the reader had it');
});

test('a sweep waits for a hidden tab to come back before scrolling', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Hidden</title></head><body></body></html>', {
        url: 'https://chatgpt.com/c/hidden',
        pretendToBeVisual: true
    });
    const totalMessages = 20;
    installVirtualizedConversation(dom.window, totalMessages);

    let hidden = true;
    Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden, configurable: true });
    dom.window.setTimeout(() => { hidden = false; }, 400);

    const conversation = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0,
        maxDuration: 8000
    });

    assert.equal(hidden, false);
    assert.equal(conversation.messages.length, totalMessages, 'nothing is lost to a backgrounded tab');
    assert.equal(conversation.complete, true);
});

test('an answer still being written is waited for, not exported half-finished', async () => {
    const dom = new JSDOM(`<!DOCTYPE html>
<html><head><title>Streaming</title></head><body><main>
    <div data-message-author-role="user"><p>Write me the long version please</p></div>
    <div data-message-author-role="assistant" id="live"><p>The answer begins here</p></div>
</main></body></html>`, { url: 'https://chatgpt.com/c/streaming', pretendToBeVisual: true });

    const { window } = dom;
    const live = window.document.querySelector('#live p');
    let ticks = 0;
    const typing = window.setInterval(() => {
        live.textContent += ` and continues with sentence ${++ticks}.`;
        if (ticks === 4) window.clearInterval(typing);
    }, 120);

    const conversation = await engine.extractConversationFull({
        document: window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(ticks, 4, 'the sweep waited for the answer to stop growing');
    assert.match(conversation.messages[1].content, /sentence 4\./, 'the finished answer is what gets exported');
    assert.equal(conversation.complete, true);
});

test('a stream that never stops is exported with a warning rather than hanging', async () => {
    const dom = new JSDOM(`<!DOCTYPE html>
<html><head><title>Endless stream</title></head><body><main>
    <div data-message-author-role="user"><p>Keep going forever please</p></div>
    <div data-message-author-role="assistant" id="live"><p>Still writing</p></div>
</main></body></html>`, { url: 'https://chatgpt.com/c/endless-stream', pretendToBeVisual: true });

    const { window } = dom;
    const live = window.document.querySelector('#live p');
    const typing = window.setInterval(() => { live.textContent += ' more'; }, 20);

    const conversation = await engine.extractConversationFull({
        document: window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0,
        maxDuration: 600
    });
    window.clearInterval(typing);

    assert.equal(conversation.complete, false, 'a cut-off answer is not passed off as complete');
    assert.ok(conversation.messages.length >= 1);
});

test('Gemini conversations sweep through their virtualized scroller too', async () => {
    // The Gemini exporter goes through the same async path, but Gemini marks
    // turns up as custom elements with no message ids.
    const dom = new JSDOM('<!DOCTYPE html><html><head><title>Gemini thread</title></head><body></body></html>', {
        url: 'https://gemini.google.com/app/abc123',
        pretendToBeVisual: true
    });
    const { window, window: { document } } = dom;

    const scroller = document.createElement('infinite-scroller');
    scroller.style.overflowY = 'auto';
    document.body.appendChild(scroller);

    const TURN_HEIGHT = 100;
    const CLIENT_HEIGHT = 300;
    const totalTurns = 16;
    let scrollTop = 0;
    const render = () => {
        while (scroller.firstChild) scroller.removeChild(scroller.firstChild);
        for (let i = 0; i < totalTurns; i++) {
            const top = i * TURN_HEIGHT;
            if (!(top < scrollTop + CLIENT_HEIGHT && top + TURN_HEIGHT > scrollTop)) continue;
            const turn = document.createElement(i % 2 === 0 ? 'user-query' : 'model-response');
            turn.getBoundingClientRect = () => ({ top: top - scrollTop, bottom: top - scrollTop + TURN_HEIGHT, height: TURN_HEIGHT, left: 0, right: 100, width: 100 });
            const body = document.createElement(i % 2 === 0 ? 'div' : 'message-content');
            body.className = i % 2 === 0 ? 'query-text' : 'markdown';
            body.textContent = `Gemini turn number ${i} with enough body text to be exported.`;
            turn.appendChild(body);
            scroller.appendChild(turn);
        }
    };
    Object.defineProperty(scroller, 'scrollHeight', { get: () => totalTurns * TURN_HEIGHT, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { get: () => CLIENT_HEIGHT, configurable: true });
    Object.defineProperty(scroller, 'scrollTop', {
        get: () => scrollTop,
        set(value) {
            scrollTop = Math.max(0, Math.min(value, totalTurns * TURN_HEIGHT - CLIENT_HEIGHT));
            render();
        },
        configurable: true
    });
    render();

    const single = engine.extractConversation({ document, provider: 'gemini', format: 'markdown' });
    assert.ok(single.messages.length < totalTurns, 'a single pass only sees the rendered window');

    const full = await engine.extractConversationFull({
        document,
        provider: 'gemini',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.equal(full.messages.length, totalTurns, 'every Gemini turn is captured');
    const order = full.messages.map(message => Number(message.content.match(/turn number (\d+)/)[1]));
    assert.deepEqual(order, Array.from({ length: totalTurns }, (unused, index) => index));
    assert.deepEqual(full.messages.map(m => m.sender).slice(0, 4), ['You', 'Gemini', 'You', 'Gemini']);
    assert.equal(full.complete, true);
});

test('full extraction without a scrollable container matches single-pass output', async () => {
    const dom = new JSDOM(chatGptFixture(), { url: 'https://chatgpt.com/c/static' });
    const single = engine.extractConversation({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown'
    });
    const full = await engine.extractConversationFull({
        document: dom.window.document,
        provider: 'chatgpt',
        format: 'markdown',
        scrollDelay: 0
    });

    assert.deepEqual(full.messages.map(m => m.content), single.messages.map(m => m.content));
});
