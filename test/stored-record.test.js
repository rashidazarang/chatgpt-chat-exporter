// Shapes from ChatGPT's stored conversation record that a real export
// (2026-09-25, 142 messages) lost or mislabelled: generated images stored as
// tool replies, tool calls surfacing as "progress", and images beyond a fixed
// time budget. Record shapes follow a sanitized public capture; content is
// synthetic.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine');

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function record(nodes) {
    const mapping = {};
    nodes.forEach((message, index) => {
        mapping[`n${index}`] = {
            parent: index ? `n${index - 1}` : null,
            children: index + 1 < nodes.length ? [`n${index + 1}`] : [],
            message: { id: `m${index}`, recipient: 'all', create_time: 1790000000 + index, metadata: {}, ...message }
        };
    });
    return { current_node: `n${nodes.length - 1}`, mapping };
}

const say = (role, text, extra = {}) => ({ author: { role }, content: { content_type: 'text', parts: [text] }, ...extra });
const hidden = message => ({ ...message, metadata: { ...message.metadata, is_visually_hidden_from_conversation: true } });
const generated = (...pointers) => ({
    author: { role: 'tool', name: 't2uay3k.sj1i4kz' },
    content: { content_type: 'multimodal_text', parts: pointers.map(asset_pointer => ({ content_type: 'image_asset_pointer', asset_pointer, width: 1024, height: 1024 })) }
});

function json(body, status = 200) {
    return { ok: status === 200, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
}

function page(stored, { onFile } = {}) {
    const dom = new JSDOM('<title>Stored record</title><main></main>', { url: 'https://chatgpt.com/c/stored-record' });
    const downloads = [];
    dom.window.fetch = async url => {
        if (url === '/api/auth/session') return json({ accessToken: 'fixture-token' });
        if (url.startsWith('/backend-api/conversation/')) return json(stored);
        const file = String(url).match(/\/files\/download\/([^?]+)/);
        if (file) {
            downloads.push(decodeURIComponent(file[1]));
            onFile?.();
            return json({ status: 'success', download_url: `https://cdn.example/${file[1]}` });
        }
        if (String(url).startsWith('https://cdn.example/')) {
            onFile?.();
            return new Response(png, { headers: { 'content-type': 'image/png' } });
        }
        return json({}, 404);
    };
    return { dom, downloads };
}

function extract(dom, options = {}) {
    return engine.extractConversationFull({ document: dom.window.document, provider: 'chatgpt',
        format: 'markdown', awaitStreaming: false, ...options });
}

const images = content => (content.match(/!\[Generated image\]\(data:image\/png;base64,/g) || []).length;

test('a reply that is only a generated image is exported, once', async t => {
    // ChatGPT stores a hidden copy of the image beside the visible one.
    const copy = generated('sediment://file_00000000aa11');
    copy.content.parts.push('tool text');
    const { dom, downloads } = page(record([
        say('user', 'Design the activity feed.'),
        generated('sediment://file_00000000aa11'),
        hidden(copy),
        hidden(say('tool', 'tool text', { author: { role: 'tool', name: 't2uay3k.sj1i4kz' } })),
        { author: { role: 'assistant' }, content: { content_type: 'reasoning_recap', content: 'Thought for 9s' } },
        say('user', 'Thanks.')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(result.source, 'payload');
    assert.deepEqual(result.messages.map(m => m.senderType), ['user', 'assistant', 'user']);
    assert.equal(images(result.messages[1].content), 1);
    assert.deepEqual(downloads, ['file_00000000aa11'], 'a sediment:// pointer is downloaded by its file id');
    assert.equal(result.complete, true);
});

test('a caption before a generated image stays with it, and the empty reply after it is not an answer', async t => {
    const { dom } = page(record([
        say('user', 'Design the agents view.'),
        say('assistant', 'The agents view lists persistent contributors.'),
        { author: { role: 'assistant' }, recipient: 't2uay3k.sj1i4kz', content: { content_type: 'code', text: '{"prompt":"agents"}' } },
        generated('sediment://file_00000000bb22'),
        say('assistant', '')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(result.messages.length, 2);
    assert.match(result.messages[1].content, /Reasoning \/ progress:[\s\S]*persistent contributors[\s\S]*!\[Generated image\]/);
    assert.equal(images(result.messages[1].content), 1);
});

test('messages addressed to a tool never reach the export, even as progress', async t => {
    const { dom } = page(record([
        say('user', 'Summarize the page.'),
        say('assistant', 'This code was redacted.', { recipient: 'python' }),
        say('assistant', 'The output of this plugin was redacted.', { recipient: 'browser' }),
        say('assistant', 'Here is the summary.')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.deepEqual(result.messages.map(m => m.content), ['Summarize the page.', 'Here is the summary.']);
});

test('an uploaded image is one image, whatever its pointer scheme', async t => {
    const { dom, downloads } = page(record([
        { author: { role: 'user' }, content: { content_type: 'multimodal_text', parts: [
            { content_type: 'image_asset_pointer', asset_pointer: 'file-service://file-Upload01' },
            { content_type: 'image_asset_pointer', asset_pointer: 'sediment://file_00000000dd44' },
            'Review these.'
        ] }, metadata: { attachments: [
            { id: 'file-Upload01', name: 'diagram.png', mime_type: 'image/png' },
            { id: 'file_00000000dd44', name: 'sketch.png', mime_type: 'image/png' }
        ] } },
        say('assistant', 'Reviewed.')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.deepEqual(downloads, ['file-Upload01', 'file_00000000dd44']);
    assert.deepEqual(result.messages[0].content.match(/!\[[^\]]+\]/g), ['![diagram.png]', '![sketch.png]']);
    assert.doesNotMatch(result.messages[0].content, /file-service/);
});

test('every image in a multi-image reply is exported, though they share a name', async t => {
    const { dom } = page(record([
        say('user', 'Two variations, please.'),
        generated('sediment://file_00000000cc01', 'sediment://file_00000000cc02')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(images(result.messages[1].content), 2);
});

test('a chart from code execution is exported as the answer', async t => {
    const { dom, downloads } = page(record([
        say('user', 'Plot it.'),
        { author: { role: 'assistant' }, recipient: 'python', content: { content_type: 'code', text: 'plot()' } },
        { author: { role: 'tool', name: 'python' }, content: { content_type: 'execution_output', text: '' },
            metadata: { aggregate_result: { messages: [{ message_type: 'image', image_url: 'file-service://file-Chart01', width: 640, height: 480 }] } } },
        say('assistant', 'The trend is rising.')
    ]));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.deepEqual(result.messages.map(m => m.senderType), ['user', 'assistant', 'assistant']);
    assert.match(result.messages[1].content, /!\[Code output\]\(data:image\/png;base64,/);
    assert.deepEqual(downloads, ['file-Chart01']);
    assert.equal(result.messages[2].content, 'The trend is rising.');
});

test('image time grows with the number of images instead of stopping after the first few', async t => {
    let clock = 0;
    const uploads = Array.from({ length: 20 }, (_, index) => ({ id: `file_${String(index).padStart(12, '0')}`, name: `photo-${index}.png`, mime_type: 'image/png' }));
    const { dom } = page(record([
        say('user', 'Here are the screenshots.', { metadata: { attachments: uploads } }),
        say('assistant', 'Received.')
    ]), { onFile: () => { clock += 1000; } });
    t.after(() => dom.window.close());
    // Every request costs a second of the export's clock; twenty images
    // need forty seconds — past the fixed fifteen that used to apply.
    dom.window.performance.now = () => clock;
    const events = [];
    const result = await extract(dom, { onProgress: event => events.push(event) });
    assert.equal((result.messages[0].content.match(/!\[photo-\d+\.png\]\(data:image\/png;base64,/g) || []).length, 20);
    assert.doesNotMatch(result.messages[0].content, /\[Image: /);
    const last = events.filter(event => event.phase === 'attachments').pop();
    assert.equal(last.lastPreview, 'Image 20 of 20');
});

test('an explicit metadata budget still bounds image downloads', async t => {
    let clock = 0;
    const uploads = Array.from({ length: 5 }, (_, index) => ({ id: `file_${index}`, name: `photo-${index}.png`, mime_type: 'image/png' }));
    const { dom } = page(record([say('user', 'Screens.', { metadata: { attachments: uploads } })]), { onFile: () => { clock += 1000; } });
    t.after(() => dom.window.close());
    dom.window.performance.now = () => clock;
    const result = await extract(dom, { metadataMaxDuration: 3000 });
    const content = result.messages[0].content;
    assert.ok((content.match(/\[Image: photo-\d\.png\]/g) || []).length >= 3, content.replace(/base64,[^)]+/g, 'base64,…'));
});

test('earlier versions sit beside the turn they replaced when a turn renders nothing', async t => {
    const stored = record([
        say('user', ''),
        say('assistant', 'Current first answer.'),
        say('user', 'Second question.'),
        say('assistant', 'Second answer.')
    ]);
    stored.mapping.n0.children.push('old');
    stored.mapping.old = { parent: 'n0', children: [], message: { id: 'old', recipient: 'all', metadata: {},
        author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Replaced first answer.'] } } };
    const { dom } = page(stored);
    t.after(() => dom.window.close());
    const result = await extract(dom, { includeVariants: true });
    const bodies = result.messages.map(m => m.content);
    assert.equal(bodies[0], 'Current first answer.');
    assert.match(bodies[1], /Earlier version[\s\S]*Replaced first answer\./);
    assert.equal(bodies[2], 'Second question.');
});

// A second real export (93 messages, 2026-09-25) was flagged incomplete for
// two replies ChatGPT itself never finished, hours before its last turn: one
// with no saved text, dropped so two prompts sat in a row, and one stopped
// inside a code block whose open fence swallowed the rest of the file.
function interruptedConversation(finalStatus = 'finished_successfully') {
    const turn = (message, status = 'finished_successfully') => ({ status, ...message });
    return record([
        turn(say('user', 'Design the desk.')),
        turn(say('assistant', 'Here is the desk.')),
        turn(say('user', 'Write the full protocol spec.')),
        turn({ author: { role: 'assistant' }, content: { content_type: 'thoughts', thoughts: [] } }, 'in_progress'),
        turn(say('assistant', ''), 'in_progress'),
        turn(say('user', 'Audit these older documents.')),
        turn(say('assistant', 'I would use this:\n\n```text\n# Research Handoff\nApproach this as terminology design for a long-lived'), 'finished_partial_completion'),
        turn(say('user', 'One more question.')),
        turn(say('assistant', 'Final answer.'), finalStatus)
    ]);
}

test('replies interrupted before the last turn do not make an export incomplete', async t => {
    const { dom } = page(interruptedConversation());
    t.after(() => dom.window.close());
    const { conversation, content } = await engine.exportConversationFull({ document: dom.window.document,
        provider: 'chatgpt', format: 'markdown', awaitStreaming: false, download: false, notify: false });
    assert.equal(conversation.complete, true);
    assert.doesNotMatch(content, /may be incomplete/);
    assert.deepEqual(conversation.messages.map(m => m.senderType),
        ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    assert.equal(conversation.messages[3].content, '*No reply: this response was interrupted in ChatGPT before any text was saved.*');
    assert.equal(conversation.messages[5].content,
        'I would use this:\n\n```text\n# Research Handoff\nApproach this as terminology design for a long-lived\n```\n\n*This response was not finished in ChatGPT; it ends here.*');
    assert.equal((content.match(/^```/gm) || []).length % 2, 0, 'every code fence in the file is closed');
});

test('a final answer still being written makes the export incomplete', async t => {
    const { dom } = page(interruptedConversation('in_progress'));
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(result.complete, false);
    assert.equal(result.unfinishedMessages, true);
    assert.match(result.messages[result.messages.length - 1].content, /Final answer\.\n\n\*This response was not finished/);
});

test('a stale tool call beside a finished final answer is not streaming', async t => {
    const stored = record([
        say('user', 'Plot it.', { status: 'finished_successfully' }),
        { author: { role: 'assistant' }, recipient: 'python', status: 'in_progress', content: { content_type: 'code', text: 'plot()' } },
        say('assistant', 'Here is the plot.', { status: 'finished_successfully' })
    ]);
    const { dom } = page(stored);
    t.after(() => dom.window.close());
    const result = await extract(dom);
    assert.equal(result.complete, true);
    assert.equal(result.messages[1].content, 'Here is the plot.');
});

test('HTML and PDF exports say where an unfinished reply ends', async t => {
    const stored = record([
        say('user', 'Write it.', { status: 'finished_successfully' }),
        say('assistant', 'Partial text', { status: 'finished_partial_completion' }),
        say('user', 'Next.', { status: 'finished_successfully' }),
        say('assistant', 'Done.', { status: 'finished_successfully' })
    ]);
    const { dom } = page(stored);
    t.after(() => dom.window.close());
    dom.window.document.querySelector('main').innerHTML = ['Write it.', 'Partial text', 'Next.', 'Done.'].map((text, index) =>
        `<div data-message-author-role="${index % 2 ? 'assistant' : 'user'}" data-message-id="m${index}"><p>${text}</p></div>`).join('');
    const result = await extract(dom, { format: 'html', scroll: false });
    assert.equal(result.complete, true);
    assert.match(result.messages[1].content, /Partial text[\s\S]*<em>This response was not finished in ChatGPT; it ends here\.<\/em>/);
    assert.doesNotMatch(result.messages[3].content, /not finished/);
});

test('exports are dated by the reader\'s calendar day, not UTC\'s', t => {
    const zone = process.env.TZ;
    process.env.TZ = 'America/Mexico_City';
    t.after(() => {
        if (zone === undefined) delete process.env.TZ;
        else process.env.TZ = zone;
    });
    const dom = new JSDOM('<title>Evening export</title><main><div data-message-author-role="user">Hi</div></main>', { url: 'https://chatgpt.com/?temporary-chat=true' });
    t.after(() => dom.window.close());
    // 18:11 on 25 September in Mexico City is already 26 September in UTC.
    const conversation = engine.extractConversation({ document: dom.window.document, provider: 'chatgpt', date: new Date(Date.UTC(2026, 8, 26, 0, 11)) });
    assert.equal(conversation.date, '2026-09-25');
});
