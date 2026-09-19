const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const engine = require('../src/extraction-engine');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');

test('diagnostics and every userscript report the package version', () => {
    assert.equal(engine.version, version);
    for (const file of ['chatgpt-markdown-exporter.user.js', 'chatgpt-pdf-exporter.user.js']) {
        assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes(`// @version      ${version}\n`));
    }
});

for (const id of ['chatgpt-markdown', 'chatgpt-html', 'chatgpt-pdf', 'gemini-markdown']) {
    test(`${id} bookmarklet executes its embedded exporter and downloads without loading code`, { timeout: 5000 }, async t => {
        const gemini = id.startsWith('gemini');
        const dom = new JSDOM(`<title>Bookmark audit</title><main>${gemini
            ? '<user-query>Hello there</user-query><model-response>Testing export</model-response>'
            : '<div data-message-author-role="user">Hello there</div><div data-message-author-role="assistant">Testing export</div>'}</main>`,
        { url: gemini ? 'https://gemini.google.com/app/test' : 'https://chatgpt.com/?temporary-chat=true', runScripts: 'outside-only' });
        t.after(() => dom.window.close());
        const blobs = [];
        const downloads = [];
        dom.window.Blob = class { constructor(parts) { blobs.push(parts.join('')); } };
        dom.window.URL.createObjectURL = () => 'blob:fixture';
        dom.window.URL.revokeObjectURL = () => {};
        dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
        dom.window.fetch = () => { throw new Error('No code or payload fetch expected for this fixture'); };
        const uri = fs.readFileSync(path.join(root, 'public/bookmarklets', `${id}.txt`), 'utf8').trim();
        assert.match(uri, /^javascript:/);
        const code = decodeURIComponent(uri.slice('javascript:'.length));
        assert.equal(dom.window.eval(code), undefined, 'bookmark must not replace the document');
        for (let attempt = 0; attempt < 150 && !downloads.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(downloads.length, 1);
        assert.match(blobs[0], /Hello there/);
        assert.match(blobs[0], /Testing export/);
        assert.equal(dom.window.document.title, 'Bookmark audit');
        assert.match(downloads[0], id.endsWith('markdown') ? /\.md$/ : /\.html$/);
        assert.equal(dom.window.document.querySelector('script[src]'), null);
    });
}
