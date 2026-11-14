'use strict';

var preact = require('preact');
var hooks = require('preact/hooks');
var html = require('htm').bind(preact.h);
var events = new (require('events').EventEmitter)();
var fs = require('fs');
var path = require('path');
var config = initSputnikConfig();
var feedsStorage = require('./models/feedsStorage').make(path.join(config.dataHomeFolder, 'feeds.json'));
var articlesStorage = require('./models/articlesStorage').make(path.join(config.dataHomeFolder, 'articles.nedb'));
var feedsService = require('./services/feedsService')(events, feedsStorage, require('./helpers/opml'));
var articlesService = require('./services/articlesService')(events, articlesStorage, feedsService);
var net = require('./helpers/net');
var feedParser = require('./helpers/feedParser');
var downloadService = require('./services/downloadService')(
    net,
    feedParser,
    config,
    feedsService,
    articlesService,
    require('./helpers/feedsWaitingRoom').init(path.join(config.dataHomeFolder, 'feeds-waiting-room'))
);
var faviconsService = require('./services/faviconsService')(config, net, events);
var articleHtml = require('./helpers/articleHtml');
var feedScout = require('./helpers/feedScout');
var ArticleCard = require('./components/ArticleCard');
var h = preact.h;
var useEffect = hooks.useEffect;
var useState = hooks.useState;
var pathToFileURL = require('url').pathToFileURL;

function currentRoute() {
    var match = window.location.hash.match(/^#\/([^/?]*)/);
    return match ? match[1] : '';
}

function feedUrlsFor(selection) {
    if (selection.type === 'feed') {
        return [selection.url];
    }
    if (selection.type === 'category') {
        return selection.feeds.map(function (feed) {
            return feed.url;
        });
    }
    return feedsService.feeds.map(function (feed) {
        return feed.url;
    });
}

function safeExternalLink(value) {
    var safe = articleHtml.httpUrl(value);
    if (!safe) {
        return '';
    }
    try {
        var parsed = new URL(safe);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch (error) {
        return '';
    }
}

function faviconUrl(feed) {
    if (!feed.favicon) {
        return '';
    }
    var file = path.resolve(feed.favicon);
    var faviconDirectory = path.resolve(config.dataHomeFolder, 'favicons') + path.sep;
    if (file.toLowerCase().indexOf(faviconDirectory.toLowerCase()) !== 0 ||
        !/\.(ico|png|gif)$/i.test(file)) {
        return '';
    }
    return pathToFileURL(file).href;
}

function App() {
    var _a = useState(0), revision = _a[0], setRevision = _a[1];
    var _b = useState(currentRoute()), route = _b[0], setRoute = _b[1];
    var _c = useState('all'), selectedKey = _c[0], setSelectedKey = _c[1];
    var _d = useState(''), selectedTagId = _d[0], setSelectedTagId = _d[1];
    var _e = useState(0), page = _e[0], setPage = _e[1];
    var _f = useState([]), articles = _f[0], setArticles = _f[1];
    var _g = useState(null), articlePage = _g[0], setArticlePage = _g[1];
    var _h = useState(false), loadingArticles = _h[0], setLoadingArticles = _h[1];
    var _i = useState(false), refreshing = _i[0], setRefreshing = _i[1];
    var _j = useState(''), message = _j[0], setMessage = _j[1];
    var _k = useState(''), error = _k[0], setError = _k[1];
    var _l = useState(''), feedUrl = _l[0], setFeedUrl = _l[1];
    var _m = useState(''), category = _m[0], setCategory = _m[1];
    var _n = useState(''), newCategory = _n[0], setNewCategory = _n[1];
    var _o = useState(''), newTag = _o[0], setNewTag = _o[1];

    useEffect(function () {
        function changed() {
            setRevision(function (value) { return value + 1; });
        }
        function onRouteChange() {
            setRoute(currentRoute());
        }
        function onFeedSiteUrlSpecified(feed) {
            faviconsService.updateOne(feed).catch(showError);
        }
        function onFeedRemoved(feed) {
            faviconsService.deleteFaviconIfHas(feed);
        }
        function onFeedsImported() {
            faviconsService.updateMany(feedsService.feeds).catch(showError);
        }
        [
            'feedAdded',
            'feedRemoved',
            'feedsImported',
            'unreadArticlesRecounted',
            'tagsListChanged',
            'articleReadStateChanged',
            'articleTagsChanged',
            'faviconUpdated',
            'feedSiteUrlSpecified'
        ].forEach(function (name) { events.on(name, changed); });
        events.on('feedSiteUrlSpecified', onFeedSiteUrlSpecified);
        events.on('feedRemoved', onFeedRemoved);
        events.on('feedsImported', onFeedsImported);
        window.addEventListener('hashchange', onRouteChange);
        faviconsService.updateMany(feedsService.feeds.filter(function (feed) {
            return feed.siteUrl && !feed.favicon;
        })).catch(showError);
        var cleanupTimer = window.setTimeout(function cleanupOldArticles() {
            articlesService.removeOlderThan(
                Date.now() - config.keepArticlesForMonths * 31 * 24 * 60 * 60 * 1000,
                config.keepTaggedArticlesForever
            ).then(function () {
                setRevision(function (value) { return value + 1; });
            }, showError);
            cleanupTimer = window.setTimeout(cleanupOldArticles, 3 * 24 * 60 * 60 * 1000);
        }, 30000);
        if (feedsService.feeds.length > 0) {
            refreshFeeds();
        }
        return function () {
            [
                'feedAdded',
                'feedRemoved',
                'feedsImported',
                'unreadArticlesRecounted',
                'tagsListChanged',
                'articleReadStateChanged',
                'articleTagsChanged',
                'faviconUpdated'
            ].forEach(function (name) { events.removeListener(name, changed); });
            events.removeListener('feedSiteUrlSpecified', onFeedSiteUrlSpecified);
            events.removeListener('feedRemoved', onFeedRemoved);
            events.removeListener('feedsImported', onFeedsImported);
            window.removeEventListener('hashchange', onRouteChange);
            window.clearTimeout(cleanupTimer);
        };
    }, []);

    var tree = feedsService.tree;
    var selection = selectedKey === 'all' ? feedsService :
        tree.reduce(function (found, item) {
            if (found) {
                return found;
            }
            if (item.type === 'feed' && selectedKey === 'feed:' + item.url) {
                return item;
            }
            if (item.type === 'category' && selectedKey === 'category:' + item.title) {
                return item;
            }
            return null;
        }, null) || feedsService;

    useEffect(function () {
        var cancelled = false;
        if (route !== '' || feedsService.feeds.length === 0) {
            setArticles([]);
            setArticlePage(null);
            return function () { cancelled = true; };
        }
        setLoadingArticles(true);
        articlesService.getArticles(
            feedUrlsFor(selection),
            page * config.articlesPerPage,
            (page + 1) * config.articlesPerPage,
            selectedTagId ? { tagId: selectedTagId } : {}
        ).then(function (result) {
            if (!cancelled) {
                setArticles(result.articles);
                setArticlePage(result);
                setLoadingArticles(false);
            }
        }, function (reason) {
            if (!cancelled) {
                setError(String(reason && reason.message || reason || 'Could not load articles.'));
                setLoadingArticles(false);
            }
        });
        return function () { cancelled = true; };
    }, [revision, route, selectedKey, selectedTagId, page]);

    function showError(reason) {
        setError(String(reason && reason.message || reason || 'Something went wrong.'));
    }

    function refreshFeeds() {
        if (feedsService.feeds.length === 0 || downloadService.isWorking) {
            return;
        }
        setError('');
        setMessage('');
        setRefreshing(true);
        return downloadService.download().then(function (result) {
            setRefreshing(false);
            setRevision(function (value) { return value + 1; });
            if (result && result.backgroundJob) {
                result.backgroundJob.then(function () {
                    setRevision(function (value) { return value + 1; });
                }, showError);
            }
        }, function (reason) {
            setRefreshing(false);
            showError(reason === 'No connection' ? 'No connection. Please check your internet connection.' : reason);
        });
    }

    function select(key) {
        setSelectedKey(key);
        setSelectedTagId('');
        setPage(0);
    }

    function markAllRead() {
        articlesService.markAllAsReadInFeeds(feedUrlsFor(selection)).then(function () {
            setMessage('All articles in this view are marked as read.');
            setRevision(function (value) { return value + 1; });
        }, showError);
    }

    function addFeed(event) {
        event.preventDefault();
        var input = feedUrl.trim();
        if (!input) {
            return;
        }
        var candidate = /^https?:\/\//i.test(input) ? input : 'http://' + input;
        setRefreshing(true);
        setError('');
        feedScout.scout(candidate, net, feedParser).then(function (url) {
            var chosenCategory = category === '__new__' ? newCategory.trim() : category;
            feedsService.addFeed({
                url: url,
                category: chosenCategory || undefined
            });
            setFeedUrl('');
            setCategory('');
            setNewCategory('');
            window.location.hash = '#/';
            return refreshFeeds();
        }, function (reason) {
            showError(reason && reason.code === '404' ? 'That address returned not found (404).' :
                'Could not find a working RSS or Atom feed at that address.');
        }).then(function () {
            setRefreshing(false);
        });
    }

    function importOpml(event) {
        var file = event.currentTarget.files && event.currentTarget.files[0];
        if (!file) {
            return;
        }
        try {
            var filePath = file.path || event.currentTarget.value;
            var content = fs.readFileSync(filePath, { encoding: 'utf8' });
            if (!feedsService.isValidOpml(content)) {
                throw new Error('This file is not a valid OPML document.');
            }
            feedsService.importOpml(content);
            window.location.hash = '#/';
            refreshFeeds();
        } catch (reason) {
            showError(reason);
        }
        event.currentTarget.value = '';
    }

    function exportOpml(event) {
        var file = event.currentTarget.files && event.currentTarget.files[0];
        if (!file) {
            return;
        }
        try {
            fs.writeFileSync(file.path || event.currentTarget.value, feedsService.exportOpml(), 'utf8');
            setMessage('Subscriptions exported.');
        } catch (reason) {
            showError(reason);
        }
        event.currentTarget.value = '';
    }

    function onArticleLink(event) {
        var anchor = event.target.closest && event.target.closest('a');
        if (!anchor) {
            return;
        }
        var safe = safeExternalLink(anchor.href);
        if (!safe) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        if (window.nw && window.nw.Shell) {
            window.nw.Shell.openExternal(safe);
        }
    }

    function pageHeader(title) {
        return html`<header class="page-header">
            <a class="back-link" href="#/">← All feeds</a>
            <h1>${title}</h1>
        </header>`;
    }

    function renderSidebar() {
        function renderFeedEntry(feed, child) {
            var icon = faviconUrl(feed);
            return html`<button class=${'feed-entry ' + (child ? 'feed-child ' : '') +
                (selectedKey === 'feed:' + feed.url ? 'selected' : '')}
                key=${feed.url} onClick=${function () { select('feed:' + feed.url); }}>
                <span class="feed-label">
                    ${icon ? html`<img src=${icon} alt="" />` : html`<span class="feed-icon-placeholder"></span>`}
                    <span>${feed.title}</span>
                </span>
                <b>${feed.unreadArticlesCount || ''}</b>
            </button>`;
        }
        return html`<aside class="sidebar">
            <div class="brand"><img src="visual/icon.png" alt="" /><span>Sputnik</span></div>
            <button class="add-feed-button" onClick=${function () { window.location.hash = '#/add'; }}>＋ Add feed</button>
            <button class=${'feed-entry ' + (selectedKey === 'all' ? 'selected' : '')} onClick=${function () { select('all'); }}>
                <span>All articles</span><b>${feedsService.unreadArticlesCount || ''}</b>
            </button>
            ${tree.map(function (item) {
                if (item.type === 'category') {
                    return html`<section class="feed-group" key=${item.title}>
                        <button class=${'feed-entry group-title ' + (selectedKey === 'category:' + item.title ? 'selected' : '')}
                            onClick=${function () { select('category:' + item.title); }}>
                            <span>${item.title}</span><b>${item.unreadArticlesCount || ''}</b>
                        </button>
                        ${item.feeds.map(function (feed) {
                            return renderFeedEntry(feed, true);
                        })}
                    </section>`;
                }
                return renderFeedEntry(item, false);
            })}
            <div class="sidebar-footer">
                <button onClick=${function () { window.location.hash = '#/organize'; }}>Organize</button>
                <button onClick=${function () { window.location.hash = '#/tags'; }}>Tags</button>
                <button onClick=${function () { window.location.hash = '#/importExport'; }}>Import / Export</button>
                <button onClick=${function () { window.location.hash = '#/settings'; }}>Settings</button>
                <button onClick=${function () { window.location.hash = '#/about'; }}>About</button>
            </div>
        </aside>`;
    }

    function renderArticles() {
        var tags = articlesService.allTags;
        var limit = config.articlesPerPage;
        return html`<main class="content">
            <header class="content-header">
                <div>
                    <h1>${selection.title || 'All articles'}</h1>
                    <p>${selection.unreadArticlesCount || 0} unread</p>
                </div>
                <div class="header-actions">
                    <button class="secondary-button" disabled=${!selection.unreadArticlesCount} onClick=${markAllRead}>Mark all read</button>
                    <button class="primary-button" disabled=${refreshing} onClick=${refreshFeeds}>${refreshing ? 'Refreshing…' : 'Refresh feeds'}</button>
                </div>
            </header>
            ${tags.length > 0 ? html`<label class="tag-filter">Filter by tag
                <select value=${selectedTagId} onChange=${function (event) { setSelectedTagId(event.currentTarget.value); setPage(0); }}>
                    <option value="">All tags</option>
                    ${tags.map(function (tag) { return html`<option value=${tag.id} key=${tag.id}>${tag.name}</option>`; })}
                </select>
            </label>` : null}
            ${loadingArticles ? html`<p class="empty-state">Loading articles…</p>` :
                articles.length === 0 ? html`<p class="empty-state">${feedsService.feeds.length ? 'No articles in this view.' : 'Add a feed or import your subscriptions to get started.'}</p>` :
                html`<div class="article-list">
                    ${articles.map(function (article) {
                        return html`<${ArticleCard} key=${article.guid} article=${article} tags=${tags}
                            onLink=${onArticleLink} onError=${showError}
                            onChanged=${function () { setRevision(function (value) { return value + 1; }); }} />`;
                    })}
                </div>`}
            ${articlePage && articlePage.numAll > limit ? html`<nav class="pagination">
                <button class="secondary-button" disabled=${page === 0} onClick=${function () { setPage(page - 1); }}>Previous</button>
                <span>Page ${page + 1} of ${Math.ceil(articlePage.numAll / limit)}</span>
                <button class="secondary-button" disabled=${(page + 1) * limit >= articlePage.numAll} onClick=${function () { setPage(page + 1); }}>Next</button>
            </nav>` : null}
        </main>`;
    }

    function renderAddFeed() {
        return html`<main class="content settings-page">
            ${pageHeader('Add a feed')}
            <p>Enter the address of a website or a direct RSS / Atom feed URL.</p>
            <form onSubmit=${addFeed} class="form-stack">
                <label>Website or feed URL
                    <input type="text" inputMode="url" required value=${feedUrl} onInput=${function (event) { setFeedUrl(event.currentTarget.value); }}
                        placeholder="https://example.com/feed.xml" />
                </label>
                <label>Category
                    <select value=${category} onChange=${function (event) { setCategory(event.currentTarget.value); }}>
                        <option value="">No category</option>
                        ${feedsService.categoriesNames.map(function (name) { return html`<option value=${name} key=${name}>${name}</option>`; })}
                        <option value="__new__">Create a category…</option>
                    </select>
                </label>
                ${category === '__new__' ? html`<label>New category
                    <input value=${newCategory} onInput=${function (event) { setNewCategory(event.currentTarget.value); }} />
                </label>` : null}
                <button class="primary-button" type="submit" disabled=${refreshing}>{refreshing ? 'Checking feed…' : 'Add feed'}</button>
            </form>
        </main>`;
    }

    function renderOrganize() {
        return html`<main class="content settings-page">
            ${pageHeader('Organize feeds')}
            <form class="inline-form" onSubmit=${function (event) {
                event.preventDefault();
                if (newCategory.trim()) {
                    feedsService.addCategory(newCategory.trim());
                    setNewCategory('');
                    setRevision(function (value) { return value + 1; });
                }
            }}>
                <input aria-label="New category name" placeholder="New category" value=${newCategory}
                    onInput=${function (event) { setNewCategory(event.currentTarget.value); }} />
                <button class="secondary-button" type="submit">Add category</button>
            </form>
            <div class="management-list">
                ${tree.map(function (item) {
                    if (item.type === 'category') {
                        return html`<section class="management-group" key=${item.title}>
                            <div class="management-row"><strong>${item.title}</strong>
                                <button class="secondary-button" onClick=${function () {
                                    var name = window.prompt('New category name', item.title);
                                    if (name && name.trim()) {
                                        item.setTitle(name.trim());
                                        setRevision(function (value) { return value + 1; });
                                    }
                                }}>Rename</button>
                                <button class="danger-button" onClick=${function () {
                                    if (window.confirm('Remove this category and its feeds?')) {
                                        item.remove();
                                        setRevision(function (value) { return value + 1; });
                                    }
                                }}>Remove category</button>
                            </div>
                            ${item.feeds.map(feedRow)}
                        </section>`;
                    }
                    return feedRow(item);
                })}
            </div>
        </main>`;
    }

    function feedRow(feed) {
        return html`<div class="management-row" key=${feed.url}>
            <span>${feed.title}</span>
            <select aria-label=${'Category for ' + feed.title} value=${feed.category || ''}
                onChange=${function (event) {
                    feed.category = event.currentTarget.value;
                    setRevision(function (value) { return value + 1; });
                }}>
                <option value="">No category</option>
                ${feedsService.categoriesNames.map(function (name) { return html`<option value=${name} key=${name}>${name}</option>`; })}
            </select>
            <button class="danger-button" onClick=${function () {
                if (window.confirm('Remove this feed?')) {
                    feed.remove();
                    setRevision(function (value) { return value + 1; });
                }
            }}>Remove</button>
        </div>`;
    }

    function renderTags() {
        return html`<main class="content settings-page">
            ${pageHeader('Tags')}
            <form class="inline-form" onSubmit=${function (event) {
                event.preventDefault();
                if (newTag.trim()) {
                    articlesService.addTag(newTag.trim()).then(function () {
                        setNewTag('');
                        setRevision(function (value) { return value + 1; });
                    }, showError);
                }
            }}>
                <input aria-label="New tag name" placeholder="New tag" value=${newTag}
                    onInput=${function (event) { setNewTag(event.currentTarget.value); }} />
                <button class="secondary-button" type="submit">Add tag</button>
            </form>
            <div class="management-list">
                ${articlesService.allTags.map(function (tag) {
                    return html`<div class="management-row" key=${tag.id}>
                        <strong>${tag.name}</strong>
                        <button class="secondary-button" onClick=${function () {
                            var name = window.prompt('New tag name', tag.name);
                            if (name && name.trim()) {
                                tag.setName(name.trim()).then(function () {
                                    setRevision(function (value) { return value + 1; });
                                }, showError);
                            }
                        }}>Rename</button>
                        <button class="danger-button" onClick=${function () {
                            if (window.confirm('Remove this tag from all articles?')) {
                                tag.remove().then(function () {
                                    setRevision(function (value) { return value + 1; });
                                }, showError);
                            }
                        }}>Remove</button>
                    </div>`;
                })}
            </div>
        </main>`;
    }

    function renderImportExport() {
        return html`<main class="content settings-page">
            ${pageHeader('Import and export')}
            <h2>Import subscriptions</h2>
            <p>Select an OPML file to add its feeds to Sputnik.</p>
            <input type="file" accept=".opml,.xml,text/xml" onChange=${importOpml} />
            <h2>Export subscriptions</h2>
            <p>Save your feeds as an OPML file.</p>
            <input type="file" nwsaveas="sputnik-feeds.opml.xml" onChange=${exportOpml} />
        </main>`;
    }

    function renderSettings() {
        return html`<main class="content settings-page">
            ${pageHeader('Settings')}
            <label>Articles per page
                <input type="number" min="1" max="100" value=${config.articlesPerPage}
                    onChange=${function (event) {
                        var value = Math.max(1, Math.min(100, Number(event.currentTarget.value) || 30));
                        config.articlesPerPage = value;
                        setPage(0);
                    }} />
            </label>
            <label>Keep articles for (months)
                <input type="number" min="1" max="100" value=${config.keepArticlesForMonths}
                    onChange=${function (event) {
                        config.keepArticlesForMonths = Math.max(1, Math.min(100, Number(event.currentTarget.value) || 12));
                    }} />
            </label>
            <label class="checkbox-label">
                <input type="checkbox" checked=${config.keepTaggedArticlesForever}
                    onChange=${function (event) { config.keepTaggedArticlesForever = event.currentTarget.checked; }} />
                Keep tagged articles forever
            </label>
        </main>`;
    }

    function renderAbout() {
        return html`<main class="content settings-page">
            ${pageHeader('About Sputnik')}
            <p>Sputnik is a privacy-respecting RSS and Atom reader.</p>
            <p>Sputnik does not send usage telemetry or check for updates automatically.</p>
            <p>Version ${config.version}</p>
        </main>`;
    }

    var body;
    if (route === 'add') {
        body = renderAddFeed();
    } else if (route === 'organize') {
        body = renderOrganize();
    } else if (route === 'tags') {
        body = renderTags();
    } else if (route === 'importExport') {
        body = renderImportExport();
    } else if (route === 'settings') {
        body = renderSettings();
    } else if (route === 'about') {
        body = renderAbout();
    } else {
        body = renderArticles();
    }

    return html`<div class="app-shell">
        ${renderSidebar()}
        ${body}
        ${error ? html`<div class="toast toast-error" role="alert"><span>${error}</span><button onClick=${function () { setError(''); }}>×</button></div>` : null}
        ${message ? html`<div class="toast"><span>${message}</span><button onClick=${function () { setMessage(''); }}>×</button></div>` : null}
    </div>`;
}

preact.render(h(App), document.getElementById('app'));
