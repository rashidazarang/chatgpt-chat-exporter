const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine.js');

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

    assert.ok(downloads.length > 0, `${filename} should create a downloadable blob`);
    const latest = downloads[downloads.length - 1];
    return {
        filename: latest.filename,
        content: await latest.blob.text()
    };
}

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
    assert.match(content, /- Child item/);
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
