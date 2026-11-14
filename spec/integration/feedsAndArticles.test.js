'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var EventEmitter = require('node:events');
var feedsStorageModule = require('../../app/models/feedsStorage');
var articlesStorageModule = require('../../app/models/articlesStorage');
var createFeedsService = require('../../app/services/feedsService');
var createArticlesService = require('../../app/services/articlesService');
var opml = require('../../app/helpers/opml');
var feedsWaitingRoom = require('../../app/helpers/feedsWaitingRoom');

test('stores RSS articles, tags them, and persists read state', async function (t) {
    var dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sputnik-test-'));
    t.after(function () {
        fs.rmSync(dataDirectory, { recursive: true, force: true });
    });

    var events = new EventEmitter();
    var feedsStorage = feedsStorageModule.make(path.join(dataDirectory, 'feeds.json'));
    var articlesStorage = articlesStorageModule.make(path.join(dataDirectory, 'articles.nedb'));
    var feedsService = createFeedsService(events, feedsStorage, opml);
    var articlesService = createArticlesService(events, articlesStorage, feedsService);
    var feedUrl = 'https://example.test/feed.xml';

    feedsService.addFeed({ url: feedUrl, title: 'Example feed' });
    await articlesService.digest(feedUrl, [{
        guid: 'entry-1',
        link: 'https://example.test/articles/1',
        title: 'Example article',
        description: '<p>Article body</p>',
        pubDate: new Date('2024-01-01T00:00:00.000Z')
    }]);

    var initial = await articlesService.getArticles([feedUrl], 0, 10, {});
    assert.equal(initial.articles.length, 1);
    assert.equal(initial.articles[0].feed.title, 'Example feed');
    assert.equal(initial.articles[0].isRead, false);

    await initial.articles[0].addNewTag('saved');
    var tagged = await articlesService.getArticles([feedUrl], 0, 10, {
        tagId: articlesService.allTags[0].id
    });
    assert.equal(tagged.articles.length, 1);
    assert.equal(tagged.articles[0].tags[0].name, 'saved');

    await tagged.articles[0].setIsRead(true);
    var read = await articlesService.getArticles([feedUrl], 0, 10, {});
    assert.equal(read.articles[0].isRead, true);
});

test('queues feeds safely and reports an empty queue distinctly', async function (t) {
    var dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sputnik-queue-test-'));
    t.after(function () {
        fs.rmSync(dataDirectory, { recursive: true, force: true });
    });

    var queue = feedsWaitingRoom.init(dataDirectory);
    await queue.storeOne('https://example.test/rss', Buffer.from('<rss/>'));
    var item = await queue.getOne();

    assert.equal(item.url, 'https://example.test/rss');
    assert.equal(item.data.toString('utf8'), '<rss/>');
    await assert.rejects(queue.getOne(), function (error) {
        return error.code === 'EMPTY_QUEUE';
    });
});
