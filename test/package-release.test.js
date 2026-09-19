const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');

test('release packaging removes stale files and checksums every distributed file', () => {
    const root = path.resolve(__dirname, '..');
    const destination = path.join(root, 'dist', `chatgpt-chat-exporter-v${version}`);
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'stale-fixture.txt'), 'must not ship');
    execFileSync(process.execPath, ['scripts/package-release.js'], { cwd: root });
    assert.equal(fs.existsSync(path.join(destination, 'stale-fixture.txt')), false);
    const sums = fs.readFileSync(path.join(destination, 'SHA256SUMS'), 'utf8');
    const manifest = sums.trim().split('\n').map(line => {
        const [expected, file] = line.split('  ');
        const bytes = fs.readFileSync(path.join(destination, file));
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, file);
        return file;
    });
    const actual = fs.readdirSync(destination, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.relative(destination, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .filter(file => file !== 'SHA256SUMS');
    assert.deepEqual(actual.sort(), manifest.sort());
    execFileSync(process.execPath, ['scripts/package-release.js'], { cwd: root });
    assert.equal(fs.readFileSync(path.join(destination, 'SHA256SUMS'), 'utf8'), sums);
});
