const assert = require('node:assert/strict');
const { test } = require('node:test');
const userscriptUi = require('../src/userscript-ui');
const { JSDOM } = require('jsdom');
// Exact native Share classes and sprite reference read from ChatGPT on 2026-10-08.
const nativeClass = 'no-drag cursor-interaction items-center select-none disabled:cursor-default aria-disabled:cursor-default focus:outline-hidden disabled:opacity-40 aria-disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 whitespace-nowrap flex border gap-1.5 rounded-lg text-(--color-text-toolbar-action) not-disabled:not-aria-disabled:hover:bg-primary-ghost-hover data-[state=open]:bg-primary-ghost-hover border-transparent button-toolbar py-0 text-sm leading-[18px]';
const sprite = '/cdn/assets/icons-9f0be679858ee591.svg';
const native = `<button class="${nativeClass}" type="button" aria-label="Share" data-state="closed"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><use href="${sprite}#arrow-up-open-base-light-16" fill="currentColor"></use></svg>Share</button>`;
const header = (share = '') => `<header data-app-shell-titlebar><div data-app-shell-main-titlebar><div data-app-shell-header-obstacle><div class="pointer-events-auto"><div class="flex items-center gap-toolbar-action browser:rounded-lg browser:bg-surface" id="actions">${share}<button aria-label="More" aria-haspopup="menu"><svg><use href="${sprite}#ellipsis-horizontal-light-16"></use></svg></button></div></div></div></div></header>`;
const message = '<main><div data-message-author-role="user">Fixture message</div></main>';
const tick = () => new Promise(resolve => setTimeout(resolve, 80));
function setup(t, html, options = {}) {
    const dom = new JSDOM(html, {url:'https://chatgpt.com/?temporary-chat=true', runScripts:'outside-only', pretendToBeVisual:true});
    const {window} = dom;
    // jsdom does not lay out elements. Model hidden ancestors for the visibility checks.
    window.Element.prototype.getClientRects = function() {return this.closest('[hidden], [style*="display: none"]') ? [] : [{width:100,height:32}];};
    let mutationCount = 0;
    new window.MutationObserver(records => {mutationCount += records.length;}).observe(window.document, {subtree:true,childList:true,attributes:true});
    const exports = [];
    const engine = {providers:{chatgpt:{messageSelectors:['div[data-message-author-role]']}}, exportConversationFull: async opts => {exports.push(opts.format);}};
    userscriptUi.install({document:window.document,engine,syncInterval:5,...options});
    t.after(()=>window.close());
    return {window, doc:window.document, exports, mutations:()=>mutationCount};
}
const fallback = doc => doc.getElementById('chat-exporter-share-button');
const menuLabels = doc => Array.from(doc.querySelectorAll('#chat-exporter-share-menu [role="menuitem"]')).map(el=>el.textContent);

test('first-load temporary chat receives the exact native button classes and icon in its header', async t => {
    const {doc, mutations} = setup(t, header()+message);
    await tick();
    const button = fallback(doc);
    assert.equal(button.parentElement.id,'actions');
    assert.equal(button.className,nativeClass);
    assert.equal(button.textContent,'Share');
    assert.equal(button.querySelector('svg').outerHTML, new JSDOM(native).window.document.querySelector('svg').outerHTML);
    assert.equal(button.style.cssText,'');
    assert.equal(doc.querySelector('#chat-exporter-launcher'),null);
    assert.equal(doc.querySelectorAll('#chat-exporter-share-button').length,1);
    assert.ok(mutations()<15, 'observer should settle rather than reinsert on every scan');
});

test('temporary Share exposes only working export options and preserves Escape/click dismissal', async t => {
    const {doc, exports, window} = setup(t, header()+message);
    await tick();
    fallback(doc).click();
    assert.deepEqual(menuLabels(doc),['Export to Markdown','Export to PDF']);
    assert.equal(fallback(doc).getAttribute('aria-expanded'),'true');
    doc.querySelector('#chat-exporter-share-menu [role="menuitem"]').click();
    await tick();
    assert.deepEqual(exports,['markdown']);
    assert.equal(fallback(doc).textContent,'Share');
    assert.equal(fallback(doc).getAttribute('aria-expanded'),'false');
    fallback(doc).click();
    doc.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(doc.querySelector('#chat-exporter-share-menu'),null);
    fallback(doc).click();
    fallback(doc).click();
    assert.equal(doc.querySelector('#chat-exporter-share-menu'),null);
    fallback(doc).click();
    doc.querySelector('main').click();
    assert.equal(doc.querySelector('#chat-exporter-share-menu'),null);
});

test('real Share is retained, offers existing options, and hands Share back to the native handler', async t => {
    const {doc} = setup(t, header(native)+message);
    await tick();
    assert.equal(fallback(doc),null);
    const button=doc.querySelector('#actions > button[aria-label="Share"]');
    let shared=0;
    button.addEventListener('click',()=>shared++);
    button.click();
    assert.deepEqual(menuLabels(doc),['Share…','Copy link','Export to Markdown','Export to PDF']);
    assert.equal(shared,0);
    doc.querySelector('#chat-exporter-share-menu [role="menuitem"]').click();
    assert.equal(shared,1);
});

test('native Share arrival removes the fallback and its menu without creating duplicates', async t => {
    const {doc} = setup(t, header()+message);
    await tick();
    fallback(doc).click();
    doc.getElementById('actions').insertAdjacentHTML('beforeend',native);
    await tick();
    assert.equal(fallback(doc),null);
    assert.equal(doc.getElementById('chat-exporter-share-menu'),null);
    assert.equal(doc.querySelectorAll('#actions button[aria-label="Share"]').length,1);
});

test('navigation to a temporary chat clones the real button while stripping native element identities', async t => {
    const {doc} = setup(t, header(native)+message);
    await tick();
    const real=doc.querySelector('button[aria-label="Share"]');
    real.id='native-radix-id';
    real.setAttribute('aria-controls','native-dialog-id');
    real.setAttribute('data-testid','share-chat');
    real.querySelector('svg').id='native-icon-id';
    real.classList.add('site-theme-class');
    await tick();
    real.remove();
    await tick();
    const button=fallback(doc);
    assert.ok(button.classList.contains('site-theme-class'));
    assert.equal(button.hasAttribute('aria-controls'),false);
    assert.equal(button.hasAttribute('data-testid'),false);
    assert.equal(button.querySelector('svg').id,'');
    assert.equal(button.querySelector('use').getAttribute('href'),`${sprite}#arrow-up-open-base-light-16`);
});

test('landing page removes the synthetic control and returning messages restore it', async t => {
    const {doc} = setup(t, header()+message);
    await tick();
    fallback(doc).click();
    doc.querySelector('main').innerHTML='';
    await tick();
    assert.equal(fallback(doc),null);
    assert.equal(doc.getElementById('chat-exporter-share-menu'),null);
    doc.querySelector('main').innerHTML='<div data-message-author-role="user">New message</div>';
    await tick();
    assert.ok(fallback(doc));
});

test('header arriving late or being rebuilt is handled without a floating button', async t => {
    const {doc} = setup(t,message);
    await tick();
    assert.equal(fallback(doc),null);
    doc.body.insertAdjacentHTML('afterbegin',header());
    await tick();
    const old=fallback(doc);
    assert.ok(old);
    doc.querySelector('header').outerHTML=header();
    await tick();
    assert.ok(fallback(doc));
    assert.notEqual(fallback(doc),old);
    assert.equal(doc.getElementById('chat-exporter-launcher'),null);
});

test('sidebar, message Share and hidden real Share never suppress the temporary header control', async t => {
    const {doc} = setup(t, '<nav><button aria-label="Share">Share</button></nav>'+header('<div hidden>'+native+'</div>')+message+'<article><button data-testid="share-prompt-link-turn-action-button">Share</button></article>');
    await tick();
    assert.ok(fallback(doc));
    let turnShared=0;
    doc.querySelector('article button').addEventListener('click',()=>turnShared++);
    doc.querySelector('article button').click();
    assert.equal(turnShared,1);
});

test('empty duplicate titlebar is skipped and the populated temporary header is selected', async t => {
    const {doc} = setup(t,'<header><div data-app-shell-main-titlebar></div></header>'+header()+message);
    await tick();
    assert.equal(fallback(doc).closest('header'), doc.querySelectorAll('header')[1]);
});

test('native conversation menu export rows are still injected once', async t => {
    const {doc} = setup(t,header(native)+message+'<div role="menu"><button role="menuitem" data-testid="share-conversation"><svg></svg><span>Share</span></button></div>');
    await tick();
    assert.equal(doc.querySelectorAll('[data-chat-exporter-item]').length,2);
    assert.deepEqual(Array.from(doc.querySelectorAll('[data-chat-exporter-item]')).map(el=>el.textContent),['Export to Markdown','Export to PDF']);
});

test('concurrent export requests still share one in-flight export', async t => {
    let release, started=0;
    const {window,doc}=setup(t,header()+message,{engine:{providers:{chatgpt:{messageSelectors:['div[data-message-author-role]']}},exportConversationFull:()=>{started++;return new Promise(resolve=>{release=resolve;});}}});
    await tick();
    const first=window.ChatExporter.markdown();
    const second=window.ChatExporter.pdf();
    await tick();
    assert.equal(started,1);
    assert.equal(fallback(doc).textContent,'Share');
    release();
    await Promise.all([first,second]);
    assert.equal(window.ChatExporter.showLauncher,undefined);
});

test('empty action container in an older header receives the fallback Share button', async t => {
    const {doc}=setup(t,'<header><div id="conversation-header-actions"></div></header>'+message);
    await tick();
    assert.equal(fallback(doc).parentElement.id,'conversation-header-actions');
    fallback(doc).click();
    assert.equal(fallback(doc).getAttribute('data-state'),'open');
    fallback(doc).click();
    assert.equal(fallback(doc).getAttribute('data-state'),'closed');
});

test('fallback replaces a stale native-anchored menu on its first click after navigation', async t => {
    const {doc} = setup(t, header(native)+message);
    await tick();
    const real = doc.querySelector('#actions > button[aria-label="Share"]');
    real.click();
    assert.deepEqual(menuLabels(doc), ['Share…','Copy link','Export to Markdown','Export to PDF']);
    real.remove();
    await tick();
    fallback(doc).click();
    assert.deepEqual(menuLabels(doc), ['Export to Markdown','Export to PDF']);
    assert.equal(fallback(doc).getAttribute('aria-expanded'), 'true');
});
