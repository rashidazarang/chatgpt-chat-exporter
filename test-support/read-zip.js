const assert = require('node:assert/strict');
const { crc32 } = require('node:zlib');

// Independent ZIP reader for tests: validate the central directory, offsets,
// UTF-8 names, stored sizes and CRCs before returning extracted files.
function readZip(buffer) {
    const end = buffer.length - 22;
    assert.equal(buffer.readUInt32LE(end), 0x06054b50);
    assert.equal(buffer.readUInt16LE(end + 4), 0);
    assert.equal(buffer.readUInt16LE(end + 6), 0);
    const count = buffer.readUInt16LE(end + 10);
    assert.equal(buffer.readUInt16LE(end + 8), count);
    let position = buffer.readUInt32LE(end + 16);
    assert.equal(position + buffer.readUInt32LE(end + 12), end);
    const files = new Map();
    for (let i = 0; i < count; i++) {
        assert.equal(buffer.readUInt32LE(position), 0x02014b50);
        assert.equal(buffer.readUInt16LE(position + 8), 0x0800);
        assert.equal(buffer.readUInt16LE(position + 10), 0);
        const size = buffer.readUInt32LE(position + 24);
        assert.equal(buffer.readUInt32LE(position + 20), size);
        const nameLength = buffer.readUInt16LE(position + 28);
        const name = buffer.subarray(position + 46, position + 46 + nameLength).toString('utf8');
        const local = buffer.readUInt32LE(position + 42);
        assert.equal(buffer.readUInt32LE(local), 0x04034b50);
        assert.equal(buffer.readUInt16LE(local + 6), 0x0800);
        assert.equal(buffer.readUInt16LE(local + 8), 0);
        assert.equal(buffer.readUInt32LE(local + 18), size);
        assert.equal(buffer.readUInt32LE(local + 22), size);
        assert.equal(buffer.readUInt16LE(local + 26), nameLength);
        assert.equal(buffer.subarray(local + 30, local + 30 + nameLength).toString('utf8'), name);
        const start = local + 30 + nameLength + buffer.readUInt16LE(local + 28);
        const data = buffer.subarray(start, start + size);
        assert.equal(data.length, size);
        assert.equal(crc32(data), buffer.readUInt32LE(position + 16));
        assert.equal(crc32(data), buffer.readUInt32LE(local + 14));
        assert.ok(!files.has(name));
        assert.ok(!name.startsWith('/') && !name.split('/').includes('..'));
        files.set(name, data);
        position += 46 + nameLength + buffer.readUInt16LE(position + 30) + buffer.readUInt16LE(position + 32);
    }
    assert.equal(position, end);
    return files;
}

module.exports = { readZip };
