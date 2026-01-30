
try {
    console.log('Testing require("lightningcss-darwin-arm64")...');
    const pkg = require('lightningcss-darwin-arm64');
    console.log('Success loading package:', !!pkg);
} catch (e) {
    console.error('Failed loading package:', e.message);
}

try {
    console.log('Testing require("./node_modules/lightningcss/lightningcss.darwin-arm64.node")...');
    const file = require('./node_modules/lightningcss/lightningcss.darwin-arm64.node');
    console.log('Success loading file:', !!file);
} catch (e) {
    console.error('Failed loading file:', e.message);
}

try {
    console.log('Testing lightningcss import...');
    const l = require('lightningcss');
    console.log('Success loading lightningcss:', !!l);
} catch (e) {
    console.error('Failed loading lightningcss:', e.message);
    console.error('Stack:', e.stack);
}
