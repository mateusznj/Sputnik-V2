'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var articleHtml = require('../../app/helpers/articleHtml');

test('escapes text and attribute metacharacters', function () {
    assert.equal(
        articleHtml.escape('<img src=x onerror="alert(1)">&\''),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;'
    );
});

test('allows only HTTP and HTTPS URLs in rendered links', function () {
    assert.equal(articleHtml.httpUrl('https://example.com/a?x=1&y=2'), 'https://example.com/a?x=1&amp;y=2');
    assert.equal(articleHtml.httpUrl('HTTP://example.com'), 'HTTP://example.com');
    assert.equal(articleHtml.httpUrl('javascript:alert(1)'), '');
    assert.equal(articleHtml.httpUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(articleHtml.httpUrl('//example.com/path'), '');
});

test('does not reprocess placeholders inside untrusted values', function () {
    var result = articleHtml.renderTemplate('{{title}}: {{articleContent}}', {
        title: '{{articleContent}}',
        articleContent: '<p>sanitized</p>'
    });

    assert.equal(result, '{{articleContent}}: <p>sanitized</p>');
});

test('leaves unknown template placeholders untouched', function () {
    assert.equal(articleHtml.renderTemplate('{{unknown}}', {}), '{{unknown}}');
});

test('renders RSS metadata as text while preserving sanitized article HTML', function () {
    var article = {
        id: '" onmouseover="alert(1)',
        isRead: false,
        title: '<script>alert(1)</script>',
        link: 'javascript:alert(1)',
        feed: {
            favicon: 'data:image/svg+xml,<svg onload=alert(1)>',
            title: '<img src=x onerror=alert(1)>'
        },
        tags: [{ name: '<svg onload=alert(1)>' }]
    };
    var template = '<article id="{{art.id}}"><a href="{{art.link}}">{{art.title}}</a>' +
        '{{feedInfo}}<div>{{articleTags}}</div><section>{{articleContent}}</section></article>';
    var sanitizedContent = '<p>safe content</p>';
    var rendered = articleHtml.renderArticle(template, article, sanitizedContent);

    assert.match(rendered, /id="&quot; onmouseover=&quot;alert\(1\)"/);
    assert.match(rendered, /<a href="">/);
    assert.match(rendered, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(rendered, /&lt;svg onload=alert\(1\)&gt;/);
    assert.match(rendered, /<section><p>safe content<\/p><\/section>/);
    assert.doesNotMatch(rendered, /<script>|<svg|<img src=x onerror/);
});
