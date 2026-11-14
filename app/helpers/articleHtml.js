'use strict';

exports.escape = function (value) {
    return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

exports.httpUrl = function (value) {
    var url = String(value === undefined || value === null ? '' : value).trim();
    if (!/^https?:\/\//i.test(url)) {
        return '';
    }
    return exports.escape(url);
};

exports.renderTemplate = function (template, values) {
    return template.replace(/\{\{([^{}]+)\}\}/g, function (placeholder, key) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return values[key];
        }
        return placeholder;
    });
};

exports.renderTags = function (article) {
    var tags = '';
    article.tags.forEach(function (tag) {
        tags += '<span class="article__tag-item">' + exports.escape(tag.name) + '</span> ';
    });
    return tags;
};

exports.renderArticle = function (template, article, content) {
    var faviconUrl = exports.httpUrl(article.feed.favicon);
    var feedInfo;

    if (faviconUrl) {
        feedInfo = '<img src="' + faviconUrl + '" class="article__feed-icon"/>';
    } else {
        feedInfo = '<div class="article__feed-icon  article__feed-icon--none"></div>';
    }
    feedInfo += '<span class="article__feed-title"> ' + exports.escape(article.feed.title) + '</span>';

    return exports.renderTemplate(template, {
        'art.id': exports.escape(article.id),
        isReadClass: article.isRead ? 'article--read' : '',
        'art.title': exports.escape(article.title),
        'art.link': exports.httpUrl(article.link),
        articleContent: content,
        feedInfo: feedInfo,
        articleTags: exports.renderTags(article)
    });
};
