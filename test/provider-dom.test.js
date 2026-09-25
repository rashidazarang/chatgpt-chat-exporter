// Provider page shapes verified live on 2026-09-25: ChatGPT's second
// transcript generation (logged out, which also has no stored copy to read,
// like a temporary chat) and a Gemini temporary chat.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine');
const userscriptUi = require('../src/userscript-ui');

const transcript = fs.readFileSync(path.join(__dirname, 'fixtures', 'chatgpt-transcript-2026.html'), 'utf8');

function transcriptPage(url = 'https://chatgpt.com/?temporary-chat=true') {
    const dom = new JSDOM(transcript, { url, pretendToBeVisual: true });
    dom.window.fetch = () => { throw new Error('a chat with no stored copy must not be fetched'); };
    return dom;
}

function extract(dom, options = {}) {
    return engine.extractConversationFull({ document: dom.window.document, provider: 'chatgpt',
        format: 'markdown', scroll: false, awaitStreaming: false, ...options });
}

function json(body, status = 200) {
    return { ok: status === 200, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
}

function stored(turns) {
    const mapping = {};
    turns.forEach(([id, role, text], index) => {
        mapping[`n-${id}`] = { parent: index ? `n-${turns[index - 1][0]}` : null,
            children: index + 1 < turns.length ? [`n-${turns[index + 1][0]}`] : [],
            message: { id, author: { role }, create_time: 1790000000 + index,
                content: { content_type: 'text', parts: [text] }, metadata: {} } };
    });
    return { current_node: `n-${turns[turns.length - 1][0]}`, mapping };
}

function backend(record, extra = () => null) {
    return async (url, init) => {
        const response = extra(String(url), init);
        if (response) return response;
        if (url === '/api/auth/session') return json({ accessToken: 'fixture-token' });
        if (url.startsWith('/backend-api/conversation/')) return json(record);
        return json({}, 404);
    };
}

test('ChatGPT 2026 transcript: one-word prompts and every other turn are exported (#43)', async t => {
    const dom = transcriptPage(); t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(result.complete, true);
    assert.equal(result.missedMessages, 0);
    assert.deepEqual(result.messages.map(m => m.senderType), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    assert.equal(result.messages[0].content, 'Hi');
    assert.equal(result.messages[1].content, 'Hi! How can I help?');
    assert.equal(result.messages[2].content, 'Format this, please:\n  keep this indent\nand this line');
    assert.equal(result.messages[4].content, 'OK');
    const all = result.messages.map(m => m.content).join('\n');
    assert.doesNotMatch(all, /said:|Copy|Share|Sources/);
    assert.equal(result.title, 'Conversation with ChatGPT', 'the site tagline is not a conversation title');
});

test('ChatGPT 2026 transcript: a rich answer keeps its structure', async t => {
    const dom = transcriptPage(); t.after(() => dom.window.close());
    const answer = (await extract(dom)).messages[3].content;
    for (const expected of ['## Test', '- **Bold**', '- Item two', '1. First',
        '2. Second\n\n```python\nprint("hello")\n```', '| A | B |\n| --- | --- |\n| 1 | 2 |',
        'Inline math: $E=mc^2$', '$$a+b$$', '> Blockquote', '[Example](https://example.com/)']) {
        assert.ok(answer.includes(expected), `missing ${JSON.stringify(expected)} in:\n${answer}`);
    }
});

for (const format of ['html', 'pdf']) {
    test(`${format}: the ChatGPT 2026 transcript keeps prompts, structure and sources`, async t => {
        const dom = transcriptPage(); t.after(() => dom.window.close());
        const result = await extract(dom, { format });
        assert.equal(result.messages.length, 6);
        assert.match(result.messages[0].content, />Hi</);
        assert.match(result.messages[3].content, /<h2>Test<\/h2>/);
        assert.match(result.messages[3].content, /<table>/);
        assert.match(result.messages[5].content, /<a href="https:\/\/nodejs.org\/en\/about\/previous-releases">Official Node.js releases<\/a>/);
        assert.match(result.messages[5].content, /class="references"/);
        assert.doesNotMatch(result.messages.map(m => m.content).join(''), /said:|javascript:/);
    });
}

test('ChatGPT 2026 sources become links and a References list; unsafe targets are dropped', async t => {
    const dom = transcriptPage(); t.after(() => dom.window.close());
    const answer = (await extract(dom)).messages[5].content;
    assert.match(answer, /\*\*v26\.10\.0\*\*\. \[Node\.js\]\(https:\/\/nodejs\.org\/en\/download\/archive\/v26\.10\.0\)/);
    assert.match(answer, /See \[Official Node\.js releases\]\(https:\/\/nodejs\.org\/en\/about\/previous-releases\) for the schedule\./);
    const references = answer.slice(answer.indexOf('**References:**'));
    assert.deepEqual(references.split('\n').filter(line => /^\d+\./.test(line)), [
        '1. [Node.js — Run JavaScript Everywhere](https://nodejs.org/en/download/archive/v26.10.0)',
        '2. [Node.js — Node.js Releases](https://nodejs.org/en/about/previous-releases)'
    ]);
    assert.doesNotMatch(answer, /javascript:|data:image|nodejs\.org\)\s*nodejs\.org/);
});

test('ChatGPT 2026 turns are keyed by their message ids and matched to the stored conversation', async t => {
    const dom = new JSDOM(`<title>Stored</title><main><ol data-conversation-transcript>
        <li data-message-role="user" id="u-1"><button data-user-message-bubble><p data-user-message-copy>Hi</p></button></li>
        <li data-message-role="user" id="u-1"><button data-user-message-bubble><p data-user-message-copy>Hi</p></button></li>
        <li data-message-role="assistant" id="a-1"><div data-assistant-markdown><p>Hello there.</p></div></li>
    </ol></main>`, { url: 'https://chatgpt.com/c/stored-2026' });
    t.after(() => dom.window.close());
    dom.window.fetch = backend(stored([['u-1', 'user', 'Hi'], ['a-1', 'assistant', 'Hello there.']]));
    const result = await extract(dom, { format: 'html' });
    assert.equal(result.messages.length, 2, 'a duplicate representation of one id collapses');
    assert.equal(result.complete, true);
    assert.equal(result.recoveredMessages, 0);
    assert.deepEqual(result.messages.map(m => m.timestampIso),
        [new Date(1790000000 * 1000).toISOString(), new Date(1790000001 * 1000).toISOString()]);
});

test('the stored conversation completes an HTML export whose sweep ran out of time (#41)', async t => {
    const dom = new JSDOM(`<title>Long</title><main>
        <div data-message-author-role="user" data-message-id="m5"><p>Fifth.</p></div>
        <div data-message-author-role="assistant" data-message-id="m6"><p>Sixth.</p></div>
    </main>`, { url: 'https://chatgpt.com/c/long-html' });
    t.after(() => dom.window.close());
    const timers = [];
    const setTimer = dom.window.setTimeout.bind(dom.window);
    dom.window.setTimeout = (fn, ms) => { timers.push(ms); return setTimer(fn, ms); };
    dom.window.fetch = backend(stored(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id, index) =>
        [id, index % 2 ? 'assistant' : 'user', `Stored turn ${index + 1}.`])));
    const result = await extract(dom, { format: 'html', maxDuration: 0 });
    assert.ok(timers.includes(60000), `the stored conversation gets the primary read timeout, got ${timers}`);
    assert.equal(result.recoveredMessages, 4);
    assert.equal(result.messages.length, 6);
    assert.equal(result.unreachedMessages, 0);
    assert.equal(result.complete, true, 'the stored record proves the export whole');
    assert.match(result.messages[0].content, /Stored turn 1\./);
    assert.match(result.messages[5].content, /Sixth\./);
});

test('a sweep that ran out of time without a stored copy is still reported incomplete', async t => {
    const dom = transcriptPage(); t.after(() => dom.window.close());
    const result = await extract(dom, { maxDuration: 0 });
    assert.equal(result.messages.length, 6);
    assert.equal(result.complete, false);
});

test('a turn that was on screen but never readable is filled from the stored conversation', async t => {
    const dom = new JSDOM(`<title>Unreadable</title><main>
        <div data-message-author-role="user" data-message-id="u"></div>
        <div data-message-author-role="assistant" data-message-id="a"><p>Here is the answer.</p></div>
    </main>`, { url: 'https://chatgpt.com/c/unreadable' });
    t.after(() => dom.window.close());
    dom.window.fetch = backend(stored([['u', 'user', 'Hi'], ['a', 'assistant', 'Here is the answer.']]));
    const result = await extract(dom, { format: 'pdf' });
    assert.equal(result.messages.length, 2);
    assert.match(result.messages[0].content, /Hi/);
    assert.equal(result.recoveredMessages, 1);
    assert.equal(result.missedMessages, 0);
    assert.equal(result.complete, true);
});

test('Gemini answers styled white-space: pre-wrap keep headings, lists, emphasis and code language', async t => {
    const dom = new JSDOM(`<title>Google Gemini</title>
        <style>.markdown, .markdown * { white-space: pre-wrap; }</style>
        <main>
            <user-query><div class="query-text"><h5 class="cdk-visually-hidden">You said Hi</h5><p class="query-text-line">Hi</p></div></user-query>
            <model-response><message-content><div class="markdown markdown-main-panel"><h2>Test Heading</h2><ul><li><p><span>Item one with </span><b>bold</b><span> text</span></p></li><li><p><span>Item two</span></p></li></ul><response-element class="no-md"><code-block><div class="code-block"><div class="code-block-decoration header-formatted">Python</div><div class="formatted-code-block-internal-container"><div><pre><code role="text" data-test-id="code-content" class="code-container formatted">print("hello")</code></pre></div></div></div></code-block></response-element><p><span>Plain line</span></p></div></message-content></model-response>
        </main>`, { url: 'https://gemini.google.com/app', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    const result = await engine.extractConversationFull({ document: dom.window.document, provider: 'gemini',
        format: 'markdown', scroll: false, awaitStreaming: false });
    assert.equal(result.title, 'Conversation with Gemini', 'a temporary chat tab is only "Google Gemini"');
    assert.equal(result.messages[0].content, 'Hi');
    const answer = result.messages[1].content;
    for (const expected of ['## Test Heading', '- Item one with **bold** text', '- Item two', '```python\nprint("hello")\n```', 'Plain line']) {
        assert.ok(answer.includes(expected), `missing ${JSON.stringify(expected)} in:\n${answer}`);
    }
});

test('code keeps its blank lines, and line elements end a line exactly once', t => {
    const dom = new JSDOM(`<pre><code class="language-python">def a():\n    pass\n\n\ndef b():\n    pass</code></pre>
        <pre><code><div>first</div><div><br></div><div>third</div></code></pre>`);
    t.after(() => dom.window.close());
    const [python, lines] = dom.window.document.querySelectorAll('pre');
    assert.equal(engine.internals.extractCodeBlock(python).code, 'def a():\n    pass\n\n\ndef b():\n    pass');
    assert.equal(engine.internals.extractCodeBlock(lines).code, 'first\n\nthird');
});

test('a header that is really the code never becomes the fence language', t => {
    const dom = new JSDOM('<pre><code data-testid="code-content">x = 1</code></pre>');
    t.after(() => dom.window.close());
    const block = engine.internals.extractCodeBlock(dom.window.document.querySelector('pre'));
    assert.deepEqual(block, { lang: '', code: 'x = 1' });
});

test('userscript: the 2026 transcript counts as a conversation and its per-turn Share stays native', t => {
    const dom = new JSDOM(`<main><ol data-conversation-transcript>
        <li data-message-role="user" id="u"><button data-user-message-bubble><p data-user-message-copy>Hi</p></button></li>
        <li data-message-role="assistant" id="a"><p>Hello</p><div data-message-actions role="group"><button id="turn-share" aria-label="Share">Share</button></div></li>
    </ol></main>`, { url: 'https://chatgpt.com/c/ui-2026', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    const { window } = dom;
    window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
    window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 10, right: 200, bottom: 40, left: 100, width: 100, height: 30 });
    assert.equal(userscriptUi.internals.isHeaderShareButton(window.document.querySelector('#turn-share')), null);
    userscriptUi.install({ document: window.document, engine, launcherDelay: 0, syncInterval: 0,
        exportMarkdown: () => {}, exportPdf: () => {}, copyLink: async () => {} });
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const launcher = window.document.querySelector('#chat-exporter-launcher');
    assert.ok(launcher, 'without a header Share the launcher is the entry point');
    assert.notEqual(launcher.style.display, 'none');
});

function researchRecord() {
    const record = stored([['u', 'user', 'Research this.'], ['k', 'assistant', 'Started.'], ['s', 'assistant', 'Summary.']]);
    const kickoff = record.mapping['n-k'].message;
    kickoff.author = { role: 'tool', name: 'research_kickoff_tool.start_research_task' };
    kickoff.content = { content_type: 'tool_result', parts: ['Started'] };
    kickoff.metadata = { async_task_id: 'deepresch_missing', async_task_type: 'research' };
    return record;
}

test('a Deep Research task that no longer exists is reported and the export continues (PR #38)', async t => {
    const dom = new JSDOM('<title>Research</title><main></main>', { url: 'https://chatgpt.com/c/research-404' });
    t.after(() => dom.window.close());
    let streamed = false;
    dom.window.fetch = backend(researchRecord(), url => {
        if (!url.includes('/tasks/deepresch_missing/stream')) return null;
        streamed = true;
        return json({ detail: 'Task not found' }, 404);
    });
    const result = await extract(dom);
    assert.equal(streamed, true);
    assert.equal(result.source, 'payload');
    assert.deepEqual(result.messages.map(m => m.content), ['Research this.', 'Summary.']);
    assert.equal(result.unresolvedReports, 1);
    assert.equal(result.complete, false);
});

test('a Deep Research report string is parsed once per message, however often it is consulted', async t => {
    const dom = new JSDOM('<title>Research</title><main></main>', { url: 'https://chatgpt.com/c/research-parse' });
    t.after(() => dom.window.close());
    const record = researchRecord();
    const widgetState = JSON.stringify({ report_message: { id: 'report',
        content: { content_type: 'text', parts: ['# Report\n\nBody.'] }, metadata: {} } });
    record.mapping['n-k'].message.metadata.chatgpt_sdk = { widget_state: widgetState };
    dom.window.fetch = backend(record);
    const parse = JSON.parse;
    let parses = 0;
    JSON.parse = function countingParse(text, ...rest) {
        if (text === widgetState) parses++;
        return parse.call(this, text, ...rest);
    };
    try {
        const result = await extract(dom, { includeReasoning: false });
        assert.match(result.messages[1].content, /# Report/);
    } finally {
        JSON.parse = parse;
    }
    assert.equal(parses, 1);
});
