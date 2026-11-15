'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var http = require('node:http');

test('downloads feeds with the Node adapter when XMLHttpRequest is available', async function (t) {
    var hadXmlHttpRequest = Object.prototype.hasOwnProperty.call(global, 'XMLHttpRequest');
    var originalXmlHttpRequest = global.XMLHttpRequest;
    global.XMLHttpRequest = function XMLHttpRequest() {};

    var net = require('../../app/helpers/net');
    var server = http.createServer(function (request, response) {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end('<rss><channel><title>Test feed</title></channel></rss>');
    });

    t.after(function () {
        if (hadXmlHttpRequest) {
            global.XMLHttpRequest = originalXmlHttpRequest;
        } else {
            delete global.XMLHttpRequest;
        }
        server.close();
    });

    await new Promise(function (resolve, reject) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    var address = server.address();
    var body = await net.getUrl('http://127.0.0.1:' + address.port + '/feed');

    assert.match(body.toString('utf8'), /<title>Test feed<\/title>/);
});
