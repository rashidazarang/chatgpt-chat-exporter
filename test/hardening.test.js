const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine');

const png = 'data:image/png;base64,iVBORw==';
function page(url = 'https://chatgpt.com/c/audit') {
    return new JSDOM(`<title>Audit</title><main>
        <div data-message-author-role="user" data-message-id="u">Please help.</div>
        <div data-message-author-role="assistant" data-message-id="a">Here is the answer.</div>
    </main>`, { url });
}
function payload() {
    return { current_node: 'a', mapping: {
        u: { parent: null, children: ['a'], message: { id: 'u', author: { role: 'user' }, content: { content_type: 'text', parts: ['Please help.'] }, metadata: {} } },
        a: { parent: 'u', children: [], message: { id: 'a', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Here is the answer.'] }, metadata: {} } }
    } };
}
function json(body, status = 200) {
    return { ok: status === 200, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
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
function extract(dom, options = {}) {
    return engine.extractConversationFull({ document: dom.window.document, provider: 'chatgpt',
        format: 'markdown', scroll: false, awaitStreaming: false, ...options });
}

for (const format of ['markdown', 'html', 'pdf']) {
    test(`${format}: temporary chats preserve button-wrapped images and short turns (#40)`, async t => {
        const dom = page('https://chatgpt.com/?temporary-chat=true');
        t.after(() => dom.window.close());
        dom.window.document.querySelector('main').innerHTML = `
            <section data-testid="conversation-turn-1"><div data-message-author-role="user"></div><button aria-label="Preview image"><img src="${png}" alt="Uploaded image"></button></section>
            <section data-testid="conversation-turn-2"><div data-message-author-role="assistant">OK</div><button>Copy</button></section>
            <section data-testid="conversation-turn-3"><div data-message-author-role="user">👍</div></section>`;
        dom.window.fetch = () => { throw new Error('Temporary chats must not fetch a stored conversation'); };
        const result = await extract(dom, { format });
        assert.equal(result.messages.length, 3);
        assert.equal(result.complete, true);
        assert.match(result.messages[0].content, /data:image\/png;base64,iVBORw==/);
        assert.equal(result.messages[1].content, 'OK');
        assert.equal(result.messages[2].content, '👍');
        assert.doesNotMatch(result.messages.map(x => x.content).join(''), /Copy|Preview image/);
    });
}

test('the conversation fetch has a 60s timeout and does not consume the attachment budget (#41)', async t => {
    const dom = page(); t.after(() => dom.window.close());
    const timers = [];
    const setTimer = dom.window.setTimeout.bind(dom.window);
    dom.window.setTimeout = (fn, ms) => { timers.push(ms); return setTimer(fn, ms); };
    dom.window.fetch = backend(payload());
    const result = await extract(dom);
    assert.equal(result.source, 'payload');
    assert.ok(timers.includes(60000), `expected conversation timeout, got ${timers}`);
    assert.ok(timers.includes(5000), 'session metadata still uses the shorter timeout');
});

for (const stage of ['headers', 'session-body', 'conversation-body']) {
    test(`a stalled ${stage} cannot hang the DOM fallback`, { timeout: 2000 }, async t => {
        const dom = page(); t.after(() => dom.window.close());
        let signal;
        const never = () => new Promise(() => {});
        dom.window.fetch = backend(payload(), (url, init) => {
            if (stage === 'session-body' && url.includes('/conversation/')) return json({}, 404);
            const target = stage === 'session-body' ? url === '/api/auth/session' : url.includes('/conversation/');
            if (!target) return null;
            signal = init.signal;
            return stage === 'headers' ? never() : { ...json({}), json: never };
        });
        const result = await extract(dom, { metadataFetchTimeout: 20, metadataMaxDuration: 80 });
        assert.equal(result.source, 'dom');
        assert.equal(result.messages.length, 2);
        assert.equal(signal.aborted, true);
    });
}

test('explicit conversation timeout and outer deadline are honored', { timeout: 2000 }, async t => {
    const dom = page(); t.after(() => dom.window.close());
    let signal;
    dom.window.fetch = backend(payload(), (url, init) => {
        if (!url.includes('/conversation/')) return null;
        signal = init.signal;
        return { ...json({}), json: () => new Promise(() => {}) };
    });
    const result = await extract(dom, { conversationFetchTimeout: 20, conversationMaxDuration: 50 });
    assert.equal(result.source, 'dom');
    assert.equal(signal.aborted, true);
});

function withImage() {
    const record = payload();
    record.mapping.u.message.content.parts = [];
    record.mapping.u.message.metadata.attachments = [{ id: 'file-image', name: 'upload.png', mime_type: 'image/png' }];
    return record;
}
for (const kind of ['stalled', 'oversized']) {
    test(`${kind} image bodies fall back to a labelled placeholder`, { timeout: 2000 }, async t => {
        const dom = page(); t.after(() => dom.window.close());
        let signal;
        let cancelled = false;
        let reads = 0;
        dom.window.fetch = backend(withImage(), (url, init) => {
            if (!url.includes('/files/download/')) return null;
            signal = init.signal;
            return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }),
                body: { getReader: () => ({
                    read: kind === 'stalled' ? () => new Promise(() => {}) : async () => { reads++; return { value: new Uint8Array(8), done: false }; },
                    cancel: async () => { cancelled = true; }, releaseLock() {}
                }) } };
        });
        const result = await extract(dom, { metadataFetchTimeout: 25, maxEmbeddedImageBytes: 12 });
        assert.match(result.messages[0].content, /\[Image: upload.png\]/);
        assert.doesNotMatch(result.messages[0].content, /data:image/);
        if (kind === 'stalled') assert.equal(signal.aborted, true);
        else { assert.equal(cancelled, true); assert.equal(reads, 2); }
    });
}

test('signed image downloads omit credentials/referrers, and authenticated requests refuse redirects', async t => {
    const dom = page(); t.after(() => dom.window.close());
    const calls = [];
    dom.window.fetch = backend(withImage(), (url, init) => {
        calls.push({ url, init });
        if (url.includes('/files/download/')) return json({ download_url: 'https://cdn.example/image' });
        if (url === 'https://cdn.example/image') return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
        return null;
    });
    const result = await extract(dom);
    assert.match(result.messages[0].content, /data:image\/png/);
    const cdn = calls.find(x => x.url.startsWith('https://cdn'));
    assert.equal(cdn.init.credentials, 'omit');
    assert.equal(cdn.init.referrerPolicy, 'no-referrer');
    assert.equal(cdn.init.headers, undefined);
    for (const { url, init } of calls.filter(x => x.url.startsWith('/'))) {
        assert.equal(init.redirect, 'error', url);
    }
});

for (const url of ['javascript:alert(1)', 'file:///tmp/secret', 'data:image/png;base64,iVBORw==', 'http://cdn.example/image']) {
    test(`download endpoint cannot redirect image reads to ${url.split(':')[0]}`, async t => {
        const dom = page(); t.after(() => dom.window.close());
        let unsafeFetch = false;
        dom.window.fetch = backend(withImage(), input => {
            if (input.includes('/files/download/')) return json({ download_url: url });
            if (input === url) unsafeFetch = true;
            return null;
        });
        const result = await extract(dom);
        assert.equal(unsafeFetch, false);
        assert.match(result.messages[0].content, /\[Image: upload.png\]/);
    });
}

function researchPayload() {
    const record = payload();
    const message = record.mapping.a.message;
    message.author = { role: 'tool', name: 'research_kickoff_tool.start_research_task' };
    message.content = { content_type: 'tool_result', parts: ['Started'] };
    message.metadata = { async_task_id: 'deepresch_test', async_task_type: 'research' };
    return record;
}
for (const format of ['markdown', 'html', 'pdf']) {
    test(`${format}: a stalled Deep Research stream is bounded and marks the export incomplete (PR #38)`, { timeout: 2000 }, async t => {
        const dom = page(); t.after(() => dom.window.close());
        let signal;
        dom.window.fetch = backend(researchPayload(), (url, init) => {
            if (!url.includes('/tasks/')) return null;
            signal = init.signal;
            return { ok: true, status: 200, text: () => new Promise(() => {}) };
        });
        const result = await engine.exportConversationFull({ document: dom.window.document,
            provider: 'chatgpt', format, scroll: false, awaitStreaming: false,
            metadataFetchTimeout: 25, download: false, notify: false });
        assert.equal(signal.aborted, true);
        assert.equal(result.conversation.complete, false);
        assert.equal(result.conversation.unresolvedReports, 1);
        assert.match(result.content, /may be incomplete/);
    });
}

test('completed research reports survive a following assistant summary', async t => {
    const dom = page(); t.after(() => dom.window.close());
    const record = researchPayload();
    record.mapping.a.message.metadata.chatgpt_sdk = { widget_state: JSON.stringify({ report_message: {
        id: 'report', content: { content_type: 'text', parts: ['# Full report\n\nEvidence stays here.'] }, metadata: {}
    } }) };
    record.mapping.a.children = ['summary'];
    record.mapping.summary = { parent: 'a', children: [], message: { id: 'summary', author: { role: 'assistant' },
        content: { content_type: 'text', parts: ['The report is ready.'] }, metadata: {} } };
    record.current_node = 'summary';
    dom.window.fetch = backend(record);
    const result = await extract(dom, { includeReasoning: false });
    assert.equal(result.messages.length, 3);
    assert.match(result.messages[1].content, /# Full report/);
    assert.equal(result.messages[2].content, 'The report is ready.');
});

for (const format of ['html', 'pdf']) {
    test(`${format}: a recovered research report retains citations and escaped text`, async t => {
        const dom = page(); t.after(() => dom.window.close());
        dom.window.document.querySelector('[data-message-id="a"]').remove();
        const record = researchPayload();
        record.mapping.a.message.metadata.chatgpt_sdk = { widget_state: { report_message: {
            id: 'report', create_time: 1781030820, content: { content_type: 'text', parts: ['# Research\n\n<ScRiPt>alert(1)</ScRiPt><img src=x onerror=alert(2)>'] },
            metadata: { content_references: [{ items: [{ title: 'Original source', url: 'https://example.com/evidence' }] }] }
        } } };
        dom.window.fetch = backend(record);
        const result = await extract(dom, { format });
        assert.equal(result.messages.length, 2);
        assert.equal(result.recoveredMessages, 1);
        assert.match(result.messages[1].content, /Original source/);
        assert.match(result.messages[1].content, /&lt;ScRiPt&gt;/);
        const rendered = JSDOM.fragment(result.messages[1].content);
        assert.equal(rendered.querySelectorAll('script, [onerror]').length, 0);
        assert.equal(result.messages[1].timestampIso, new Date(1781030820 * 1000).toISOString());
    });
}

for (const format of ['markdown', 'html', 'pdf']) {
    test(`${format}: repeated turns retain identity while duplicate representations collapse`, async t => {
        const dom = page('https://chatgpt.com/?temporary-chat=true'); t.after(() => dom.window.close());
        dom.window.document.querySelector('main').innerHTML = `
            <div data-message-author-role="user" data-message-id="one">OK</div>
            <div data-message-author-role="user" data-message-id="one">OK</div>
            <div data-message-author-role="assistant" data-message-id="two">OK</div>
            <div data-message-author-role="user">OK</div>
            <div data-message-author-role="user">OK</div>`;
        const result = await extract(dom, { format });
        assert.deepEqual(result.messages.map(m => m.content), ['OK', 'OK', 'OK', 'OK']);
        assert.equal(result.messages[1].senderType, 'assistant');
    });
}

for (const flaw of ['missing-current', 'unknown-current', 'cycle', 'missing-parent', 'inherited-node', 'non-string-parent']) {
    test(`invalid payload ancestry (${flaw}) never exports an alternate branch as complete`, async t => {
        const dom = page(); t.after(() => dom.window.close());
        const record = payload();
        record.mapping.alternate = { parent: 'u', message: { author: { role: 'assistant' }, content: { parts: ['UNSELECTED PRIVATE BRANCH'] } } };
        if (flaw === 'missing-current') delete record.current_node;
        if (flaw === 'unknown-current') record.current_node = 'unknown';
        if (flaw === 'cycle') record.mapping.u.parent = 'a';
        if (flaw === 'missing-parent') record.mapping.a.parent = 'absent';
        if (flaw === 'inherited-node') record.current_node = 'toString';
        if (flaw === 'non-string-parent') record.mapping.a.parent = 42;
        dom.window.fetch = backend(record);
        const result = await extract(dom);
        assert.equal(result.source, 'dom');
        assert.equal(result.complete, false);
        assert.equal(result.metadataStatus, 'invalid');
        assert.equal(result.messages.length, 2);
        assert.ok(result.messages.every(m => !m.content.includes('UNSELECTED')));
        assert.match(engine.serializers.markdown(result), /incomplete/i);
    });
}

for (const format of ['markdown', 'html', 'pdf']) {
    test(`${format}: a payload still streaming cannot be marked complete`, async t => {
        const dom = page(); t.after(() => dom.window.close());
        const record = payload(); record.mapping.a.message.status = 'in_progress';
        dom.window.fetch = backend(record);
        const result = await extract(dom, { format });
        assert.equal(result.complete, false);
        assert.equal(result.unfinishedMessages, true);
        assert.match(result.messages[1].content, /Here is the answer/);
    });
}

test('DOM image byte limits count base64 padding exactly, across all turns and duplicate nodes', async t => {
    const dom = page('https://chatgpt.com/?temporary-chat=true'); t.after(() => dom.window.close());
    dom.window.document.querySelector('main').innerHTML = ['one', 'one', 'two', 'three'].map(id =>
        `<div data-message-author-role="user" data-message-id="${id}"><img src="${png}" alt="${id}"></div>`).join('');
    const result = await extract(dom, { maxEmbeddedImageBytes: 4, maxTotalEmbeddedImageBytes: 8 });
    assert.equal(result.messages.length, 3);
    assert.match(result.messages[0].content, /data:image/);
    assert.match(result.messages[1].content, /data:image/);
    assert.equal(result.messages[2].content, '[Image: three]');
});

test('page-controlled exporter attributes cannot inject unvalidated media sources', async t => {
    const dom = page('https://chatgpt.com/?temporary-chat=true'); t.after(() => dom.window.close());
    dom.window.document.querySelector('[data-message-id="u"]').innerHTML =
        '<img data-chat-exporter-media-source="data:image/svg+xml;base64,PHN2Zz4=" alt="untrusted">';
    const result = await extract(dom);
    assert.equal(result.messages[0].content, '[Image: untrusted]');
});

test('oversized canvases are rejected before serialization or allocation', async t => {
    const dom = page('https://chatgpt.com/?temporary-chat=true'); t.after(() => dom.window.close());
    dom.window.CanvasRenderingContext2D = function () {};
    const user = dom.window.document.querySelector('[data-message-id="u"]');
    user.innerHTML = '<canvas width="10000" height="10000"></canvas>';
    let reads = 0;
    user.firstChild.toDataURL = () => { reads++; return png; };
    const result = await extract(dom, { maxCanvasPixels: 1000 });
    assert.equal(reads, 0);
    assert.equal(result.messages[0].content, '[Canvas or chart]');
});

test('DOM and downloaded attachments share a budget that bounds the next streamed read', async t => {
    const dom = page(); t.after(() => dom.window.close());
    dom.window.document.querySelector('[data-message-id="u"]').innerHTML = `<img src="${png}" alt="preview">`;
    let cancelled = false;
    let reads = 0;
    dom.window.fetch = backend(withImage(), url => {
        if (!url.includes('/files/download/')) return null;
        return { ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: { getReader: () => ({
            read: async () => { reads++; return { done: false, value: new Uint8Array(3) }; },
            cancel: async () => { cancelled = true; }, releaseLock() {}
        }) } };
    });
    const result = await extract(dom, { format: 'html', maxTotalEmbeddedImageBytes: 6 });
    assert.equal(reads, 1, 'only two bytes remain after the four-byte DOM image');
    assert.equal(cancelled, true);
    assert.equal((result.messages[0].content.match(/data:image/g) || []).length, 1);
    assert.match(result.messages[0].content, /upload.png/);
});

test('explicit non-raster image MIME types cannot be disguised by attachment metadata', async t => {
    const dom = page(); t.after(() => dom.window.close());
    dom.window.fetch = backend(withImage(), url => url.includes('/files/download/')
        ? new Response('<svg></svg>', { headers: { 'content-type': 'image/svg+xml' } }) : null);
    const result = await extract(dom);
    assert.equal(result.messages[0].content, '[Image: upload.png]');
});

test('generated-file links trim trailing punctuation in linear time', { timeout: 5000 }, async t => {
    const dom = page(); t.after(() => dom.window.close());
    const record = payload();
    record.mapping.a.message.content.parts = [
        `Saved sandbox:/mnt/data/report.csv!?. and sandbox:/mnt/data/${'!'.repeat(60000)}x`
    ];
    dom.window.fetch = backend(record);
    const started = Date.now();
    const result = await extract(dom, { sourceFromPayload: false });
    assert.ok(Date.now() - started < 1000, 'a punctuation run must not stall the export');
    assert.equal(result.messages[1].attachments[0].sandboxPath, '/mnt/data/report.csv');
    assert.equal(result.messages[1].attachments[1].sandboxPath, `/mnt/data/${'!'.repeat(60000)}x`);
});
