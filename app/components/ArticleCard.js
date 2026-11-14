'use strict';

var preact = require('preact');
var html = require('htm').bind(preact.h);
var articleHtml = require('../helpers/articleHtml');

function externalUrl(value) {
    var url = articleHtml.httpUrl(value);
    if (!url) {
        return '';
    }
    try {
        var parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch (error) {
        return '';
    }
}

module.exports = function ArticleCard(props) {
    var article = props.article;
    var link = externalUrl(article.link);
    var tags = props.tags;

    return html`<article class=${'article-card ' + (article.isRead ? 'is-read' : '')}>
        <div class="article-heading">
            <div>
                <h2>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer" onClick=${props.onLink}>${article.title || '(untitled)'}</a>` : (article.title || '(untitled)')}</h2>
                <p class="article-meta">${article.feed && article.feed.title || article.feedUrl} · ${article.pubDate && !isNaN(article.pubDate.getTime()) ? article.pubDate.toLocaleString() : ''}</p>
            </div>
            <button class="read-toggle" onClick=${function () {
                article.setIsRead(!article.isRead).then(props.onChanged, props.onError);
            }}>${article.isRead ? 'Mark unread' : 'Mark read'}</button>
        </div>
        <div class="article-body" onClick=${props.onLink}
            dangerouslySetInnerHTML=${{ __html: articleHtml.sanitize(article.content) }}></div>
        <div class="article-tags">
            ${article.tags.map(function (tag) { return html`<span class="tag-chip" key=${tag.id}>${tag.name}</span>`; })}
            ${tags.map(function (tag) {
                var attached = article.tags.some(function (current) { return current.id === tag.id; });
                return html`<button class=${'tag-toggle ' + (attached ? 'active' : '')} key=${tag.id}
                    onClick=${function () {
                        article.toggleTag(tag.id).then(props.onChanged, props.onError);
                    }}>${attached ? '−' : '+'} ${tag.name}</button>`;
            })}
        </div>
    </article>`;
};
