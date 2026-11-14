'use strict';

module.exports = function createArticlesService(events, articlesStorage, feedsService) {
    
    var Q = require('q');
    
    var tags;
    
    //-----------------------------------------------------
    // Helper functions
    //-----------------------------------------------------
    
    function getTag(tagId) {
        if (!tags) {
            return null;
        }
        for (var i = 0; i < tags.length; i += 1) {
            if (tags[i]._id === tagId) {
                return tags[i];
            }
        }
        return null;
    }
    
    function mapTagIdsToTags(tagsIds) {
        if (!tagsIds || tagsIds.length === 0) {
            return [];
        }
        var tags = tagsIds.map(getTag).filter(Boolean);
        tags.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
        return tags;
    }
    
    function hasTag(art, tagId) {
        for (var i = 0; i < art.tags.length; i += 1) {
            if (art.tags[i].id === tagId) {
                return true;
            }
        }
        return false;
    }
    
    function decorateTag(tag) {
        tag.id = tag._id;
        tag.setName = function (newName) {
            return articlesStorage.changeTagName(tag.id, newName)
            .then(function (result) {
                return reloadTags();
            });
        }
        tag.remove = function () {
            return articlesStorage.removeTag(tag.id)
            .then(function () {
                return reloadTags();
            });
        }
    }
    
    function recountUnread(feedUrl) {
        return articlesStorage.countUnread(feedUrl)
        .then(function (count) {
            events.emit('unreadArticlesCountChanged', feedUrl, count);
            return count;
        });
    }
    
    function reloadTags() {
        return articlesStorage.getTags()
        .then(function (refreshedTags) {
            refreshedTags.forEach(decorateTag);
            tags = refreshedTags;
            events.emit('tagsListChanged');
            return refreshedTags;
        });
    }
    
    function decorateArticle(art) {
        art.id = 'article-' + art._id;
        art.content = art.content || '';
        art.pubDate = new Date(art.pubTime);
        
        art.tags = mapTagIdsToTags(art.tags);
        
        art.setIsRead = function (newIsRead) {
            return articlesStorage.setArticleReadState(this.guid, newIsRead)
            .then(function () {
                return recountUnread(art.feedUrl);
            })
            .then(function () {
                art.isRead = newIsRead;
                events.emit('articleReadStateChanged', art);
            });
        };
        
        art.toggleTag = function (tagId) {
            var promise;
            if (hasTag(art, tagId)) {
                promise = articlesStorage.untagArticle(art.guid, tagId);
            } else {
                promise = articlesStorage.tagArticle(art.guid, tagId);
            }
            return promise.then(function (article) {
                art.tags = mapTagIdsToTags(article.tags);
                events.emit('articleTagsChanged', art);
            });
        };
        
        art.addNewTag = function (tagName) {
            return addTag(tagName)
            .then(function (addedTag) {
                return articlesStorage.tagArticle(art.guid, addedTag._id);
            })
            .then(function (article) {
                art.tags = mapTagIdsToTags(article.tags);
                events.emit('articleTagsChanged', art);
            });
        }
        
        art.feed = feedsService.getFeedByUrl(art.feedUrl);
    }
    
    //-----------------------------------------------------
    // Init
    //-----------------------------------------------------
    
    reloadTags();
    
    feedsService.feeds.map(function (feed) {
        recountUnread(feed.url);
    });
    
    //-----------------------------------------------------
    // API methods
    //-----------------------------------------------------
    
    function digest(feedUrl, harvestedArticles) {
        return articlesStorage.digest(feedUrl, harvestedArticles)
        .then(function () {
            return recountUnread(feedUrl);
        });
    }
    
    function getArticles(feedUrls, from, to, options) {
        return articlesStorage.getArticles(feedUrls, from, to, options)
        .then(function (result) {
            result.articles.forEach(decorateArticle);
            return result;
        });
    }
    
    function markAllAsReadInFeeds(feedUrls) {
        return articlesStorage.markAllAsRead(feedUrls)
        .then(function () {
            return Q.all(feedUrls.map(function (feedUrl) {
                return recountUnread(feedUrl);
            }));
        });
    }
    
    function addTag(name) {
        return articlesStorage.addTag(name)
        .then(function (tag) {
            return reloadTags().then(function () {
                return getTag(tag._id);
            });
        });
    }
    
    return  {
        get dbSize() {
            return articlesStorage.getDbSize();
        },
        
        digest: digest,
        
        getArticles: getArticles,
        markAllAsReadInFeeds: markAllAsReadInFeeds,
        removeAllForFeed: articlesStorage.removeAllForFeed,
        removeOlderThan: articlesStorage.removeOlderThan,
        
        get allTags() {
            return tags || [];
        },
        addTag: addTag,
    };
};