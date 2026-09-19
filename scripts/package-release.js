const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'dist', `chatgpt-chat-exporter-v${version}`);
const files = [
    'exporter-markdown.js', 'exporter-html.js', 'exporter-pdf.js',
    'gemini-exporter-markdown.js', 'selector-doctor.js',
    'chatgpt-markdown-exporter.user.js', 'chatgpt-pdf-exporter.user.js',
    'README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CLAUDE.md',
    'docs/EXPORTER_GUIDE.md', 'docs/RELEASE_AUDIT.md',
    'public/bookmarklets/index.html', `temporal/release-notes-v${version}.md`,
    ...fs.readdirSync(path.join(root, 'public/bookmarklets')).filter(name => name.endsWith('.txt')).map(name => `public/bookmarklets/${name}`)
];
// Read the entire manifest before replacing the previous staging directory.
// A failed/missing source must not erase the last usable package.
const sources = files.map(file => ({ file, bytes: fs.readFileSync(path.join(root, file)) }));
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
const sums = [];
for (const { file, bytes } of sources) {
    const target = path.join(destination, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    sums.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${file}`);
}
fs.writeFileSync(path.join(destination, 'SHA256SUMS'), `${sums.join('\n')}\n`);
console.log(`Prepared ${files.length} files and SHA256SUMS in ${destination}`);
