const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine');
const { readZip } = require('../test-support/read-zip');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMwmHnmPwAFJwKVhZG1WQAAAABJRU5ErkJggg==';

function page(t, images = true) {
    const dom = new JSDOM(`<title>Conversación 日本語</title><main>
        <div data-message-author-role="user">Please export this.</div>
        <div data-message-author-role="assistant"><p>A diagram.</p>${images ? `<img src="${png}" alt="Diagram"><img src="${png}" alt="Same diagram">` : ''}</div>
    </main>`, { url: 'https://chatgpt.com/?temporary-chat=true' });
    t.after(() => dom.window.close());
    dom.window.Blob = Blob;
    const downloads = [];
    dom.window.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:fixture'; };
    dom.window.URL.revokeObjectURL = () => {};
    dom.window.HTMLAnchorElement.prototype.click = function () { downloads.at(-1).filename = this.download; };
    return { dom, downloads };
}

test('Markdown with images downloads a valid ZIP with local links, Unicode names and exact deduplicated bytes', async t => {
    const { dom, downloads } = page(t);
    const result = await engine.exportConversationFull({ document: dom.window.document, format: 'markdown',
        scroll: false, awaitStreaming: false, notify: false });
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].type, 'application/zip');
    assert.equal(downloads[0].filename, result.filename);
    assert.match(result.filename, /^Conversación 日本語 .*\.zip$/);
    const files = readZip(Buffer.from(await downloads[0].arrayBuffer()));
    assert.equal(files.size, 2);
    assert.equal(files.get(result.filename.replace(/\.zip$/, '.md')).toString('utf8'), result.content);
    assert.equal((result.content.match(/images\/image-001.png/g) || []).length, 2);
    assert.doesNotMatch(result.content, /data:image/);
    assert.deepEqual(files.get('images/image-001.png'), Buffer.from(png.split(',')[1], 'base64'));
    assert.match(result.conversation.messages[1].content, /data:image/, 'packaging does not mutate extracted source');
});

test('text-only, unavailable media and explicit inline exports still download Markdown', async t => {
    for (const options of [{ images: false }, { maxTotalEmbeddedImageBytes: 0 }, { bundleImages: false }]) {
        const { dom, downloads } = page(t, options.images !== false);
        const result = engine.exportConversation({ document: dom.window.document, format: 'markdown', notify: false, ...options });
        assert.match(result.filename, /\.md$/);
        assert.equal(result.files.length, 0);
        assert.equal(downloads[0].type, 'text/markdown');
        assert.equal(await downloads[0].text(), result.content);
        if (options.bundleImages === false) assert.match(result.content, /data:image/);
    }
});

test('HTML/PDF retain embedded images and no-download exports expose the bundle', t => {
    const { dom, downloads } = page(t);
    for (const format of ['html', 'pdf']) {
        const result = engine.exportConversation({ document: dom.window.document, format, download: false, notify: false });
        assert.match(result.filename, /\.html$/);
        assert.match(result.content, /data:image/);
        assert.deepEqual(result.files, []);
    }
    const bundle = engine.exportConversation({ document: dom.window.document, format: 'markdown',
        filename: '../../unsafe/Custom 日本語.zip', download: false, notify: false });
    assert.equal(downloads.length, 0);
    assert.equal(bundle.filename, 'Custom 日本語.zip');
    assert.equal(bundle.files[0].path, 'Custom 日本語.md');
    assert.equal(bundle.files.length, 2);
});

test('image bundling preserves literal examples, code fences, HTML reasoning and escaped image syntax', () => {
    const literal = `![Literal](${png})`;
    const protectedText = ['```markdown', literal, '````', `\`${literal}\``, `\`\`a \` ${literal}\`\``,
        `\\${literal}`, '<pre>', literal, '</pre>', '<small>```text<br>reasoning<br>```<br></small>'].join('\n');
    const source = `${protectedText}\n[![Real \\] image](<${png}> "A title")](https://example.com)\n~~~md\n${literal}\n~~~\n![Last](${png})`;
    const bundle = engine.internals.bundleMarkdownImages(source);
    assert.equal(bundle.images.length, 1);
    assert.ok(bundle.content.startsWith(protectedText));
    assert.ok(bundle.content.includes('[![Real \\] image](<images/image-001.png> "A title")](https://example.com)'));
    assert.ok(bundle.content.endsWith('![Last](images/image-001.png)'));
    assert.ok(bundle.content.includes(`~~~md\n${literal}\n~~~`));
    const unfinished = `~~~\n${literal}`;
    assert.equal(engine.internals.bundleMarkdownImages(unfinished).content, unfinished);
});

test('only supported raster image syntax becomes files; bad data and remote URLs stay verbatim', () => {
    const source = '![SVG](data:image/svg+xml;base64,PHN2Zz4=)\n![Broken](data:image/png;base64,abc=def=)\n![Remote](https://example.com/plot.png)\n' +
        '![JPEG](data:image/jpeg;base64,/9j/2Q==)\n![GIF](data:image/gif;base64,R0lGODlh)\n![JPEG again](data:image/jpeg;base64,/9j/2Q==)';
    const bundle = engine.internals.bundleMarkdownImages(source);
    assert.deepEqual(bundle.images.map(image => image.path), ['images/image-001.jpg', 'images/image-002.gif']);
    assert.ok(bundle.content.startsWith(source.slice(0, source.indexOf('![JPEG]'))));
    assert.equal((bundle.content.match(/images\/image-001.jpg/g) || []).length, 2);
});

test('quoted fences, HTML inside fences and unmatched inline backticks cannot consume subsequent images', () => {
    const literal = `![Example](${png})`;
    const protectedText = `> \`\`\`markdown\n> ${literal}\n> \`\`\`\n\`\`\`html\n<small>\n\`\`\`\n</small>\nUnmatched \` tick\n\n`;
    const source = `${protectedText}![Visible](${png})`;
    const bundle = engine.internals.bundleMarkdownImages(source);
    assert.equal(bundle.images.length, 1);
    assert.equal(bundle.content, `${protectedText}![Visible](images/image-001.png)`);
});

test('many malformed image labels are preserved without repeatedly scanning the remaining document', { timeout: 1000 }, () => {
    const source = '![unclosed '.repeat(30000);
    const bundle = engine.internals.bundleMarkdownImages(source);
    assert.equal(bundle.content, source);
    assert.deepEqual(bundle.images, []);
});
