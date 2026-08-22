const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'node-system.js'), 'utf8');
const context = { window: {}, console, Date, Math, Map, Array, Object, JSON, String, Number };
vm.runInNewContext(source, context, { filename: 'node-system.js' });

const NodeSystem = context.window.NodeSystem;
const nodes = new NodeSystem({ sizeByContent: true });

const legacyNode = nodes.createNode({ id: 'legacy', text: 'فكرة آمنة' });
assert.equal(legacyNode.content, 'فكرة آمنة');
assert.equal(nodes.search('آمنة').length, 1);

const updated = nodes.updateNode('legacy', { text: 'فكرة محدثة' });
assert.equal(updated.content, 'فكرة محدثة');
assert.equal(nodes.search('محدثة').length, 1);

assert.equal(nodes.fromJSON(JSON.stringify([
    { id: 'imported', text: '<script>alert(1)</script>', type: 'text' },
    null,
    { type: 'invalid-without-id' }
])), true);
assert.equal(nodes.getNode('imported').content, '<script>alert(1)</script>');
assert.equal(typeof nodes.getNode('imported').metadata, 'object');
assert.equal(Array.isArray(nodes.getNode('imported').metadata), false);
assert.equal(nodes.fromJSON('{"nodes":[]}'), false);

nodes.import({
    nodeCounter: 4,
    nodes: [
        ['safe', { id: 'safe', text: 'مستورد', metadata: [] }],
        ['broken'],
        ['bad', null]
    ]
});
assert.equal(nodes.getNode('safe').content, 'مستورد');
assert.equal(typeof nodes.getNode('safe').metadata, 'object');
assert.equal(Array.isArray(nodes.getNode('safe').metadata), false);
assert.equal(nodes.getNode('broken'), undefined);
assert.equal(nodes.getNode('bad'), undefined);

console.log('orbital-mind node system regression tests passed');
