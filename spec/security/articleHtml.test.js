'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var appRequire = require('node:module').createRequire(require.resolve('../../app/package.json'));
var preact = appRequire('preact');
var renderToString = appRequire('preact-render-to-string');
var articleHtml = require('../../app/helpers/articleHtml');
var ArticleCard = require('../../app/components/ArticleCard');

test('allows only absolute HTTP and HTTPS URLs', function () {
    assert.equal(articleHtml.httpUrl('https://example.com/a?x=1&y=2'), 'https://example.com/a?x=1&y=2');
    assert.equal(articleHtml.httpUrl('HTTP://example.com'), 'HTTP://example.com');
    assert.equal(articleHtml.httpUrl('javascript:alert(1)'), '');
    assert.equal(articleHtml.httpUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(articleHtml.httpUrl('//example.com/path'), '');
    assert.equal(articleHtml.httpUrl('http://'), '');
});

test('sanitizes untrusted article markup and URL schemes', function () {
    var sanitized = articleHtml.sanitize(
        '<script>alert(1)</script><p onclick="alert(2)">Hello</p>' +
        '<a href="javascript:alert(3)">bad link</a><img src="x" onerror="alert(4)">'
    );

    assert.match(sanitized, /<p>Hello<\/p>/);
    assert.match(sanitized, /<a>bad link<\/a>/);
    assert.doesNotMatch(sanitized, /<img|<script|onclick|onerror|javascript:/i);
});

test('renders RSS metadata as text and only sanitized article HTML as markup', function () {
    var article = {
        isRead: false,
        title: '<script>alert(1)</script>',
        link: 'javascript:alert(1)',
        feedUrl: 'https://example.com/rss',
        feed: { title: '<img src=x onerror=alert(1)>' },
        pubDate: new Date('2024-01-01T00:00:00Z'),
        content: '<p>safe content</p><svg onload="alert(2)"></svg>',
        tags: [{ id: 'tag-1', name: '<svg onload=alert(3)>' }],
        setIsRead: function () {},
        toggleTag: function () {}
    };
    var rendered = renderToString(preact.h(ArticleCard, {
        article: article,
        tags: [{ id: 'tag-1', name: '<img src=x onerror=alert(4)>' }],
        onChanged: function () {},
        onError: function () {},
        onLink: function () {}
    }));

    assert.match(rendered, /&lt;script>alert\(1\)&lt;\/script>/);
    assert.match(rendered, /&lt;img src=x onerror=alert\(1\)>/);
    assert.match(rendered, /&lt;svg onload=alert\(3\)>/);
    assert.match(rendered, /&lt;img src=x onerror=alert\(4\)>/);
    assert.match(rendered, /<p>safe content<\/p>/);
    assert.doesNotMatch(rendered, /<script|<svg|<img|href="javascript:/i);
});
