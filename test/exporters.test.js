const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const repoRoot = path.resolve(__dirname, '..');

function readScript(filename) {
    return fs.readFileSync(path.join(repoRoot, filename), 'utf8');
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

async function runExporter(filename, html, url = 'https://chatgpt.com/c/test-fixture') {
    const dom = new JSDOM(html, {
        url,
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });

    const { window } = dom;
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
