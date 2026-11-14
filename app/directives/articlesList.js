'use strict';

sputnik.directive('articlesList', function ($sanitize, $rootScope) {
    
    var organizer = require('./helpers/articlesOrganizer');
    var articleHtml = require('./helpers/articleHtml');
    var fs = require('fs');
    var articleTemplate = fs.readFileSync('./views/read/article.html', { encoding: 'utf8' });
    
    var presentedArticles;
    
    //-----------------------------------------------------
    // Helper functions
    //-----------------------------------------------------
    
    function getArticleById(id) {
        for (var i = 0; i < presentedArticles.length; i += 1) {
            if (presentedArticles[i].id === id) {
                return presentedArticles[i];
            }
        }
        return null;
    }

    function getArticleElement(article) {
        return document.getElementById(article.id);
    }
    
    function getArticleForDomEvent(evt) {
        var ele = evt.target;
        while (ele.parentElement) {
            ele = ele.parentElement;
            if (ele.hasAttribute('id')) {
                return getArticleById(ele.getAttribute('id'));
            }
        }
        return null;
    }
    
    //-----------------------------------------------------
    // HTML rendering
    //-----------------------------------------------------
    
    function getDayLabelHtml(article) {
        return '<div class="articles-sheet__element  day-label">' + articleHtml.escape(article.dayLabel) + '</div>';
    }
    
    function getArticleContentHtml(article) {
        var content = article.content;
        var articleUrl = articleHtml.httpUrl(article.link);
        content = processHtml(content, articleUrl);
        try {
            content = $sanitize(content);
        } catch (err) {
            // if not sanitized, kill it as insecure
            content = 'Oops. Sorry, this article can\'t be displayed. <a href="' + articleUrl + '">See it in the browser.</a>';
        }
        return lazyLoadImages(content);
    }
    
    var cheerio = require('cheerio');
    var urlUtil = require('url');
    
    function processHtml(content, articleUrl) {
        var dom = cheerio.load(content);
        
        function flashPatch(i, elem) {
            var patchStr = '<div class="flash-patch"><a href="' + articleUrl + '">Here should be a <strong>video</strong> (probably),<br/>click to see it in the browser.</a></div>';
            dom(elem).replaceWith(patchStr);
        }
        
        dom('object').each(flashPatch);
        dom('iframe').each(flashPatch);
        
        return dom.html();
    }
    
    function lazyLoadImages(content) {
        var dom = cheerio.load(content);
        
        dom('img').each(function (i, elem) {
            var src = dom(elem).attr('src');
            if (src) {
                dom(elem).attr('data-lazy-src', src);
                dom(elem).removeAttr('src');
            }
        });
        
        return dom.html();
    }
    
    return {
        restrict: 'E',
        replace: true,
        template: '',
        scope: true,
        link: function ($scope, $element) {
            
            var articleTagsChangedWatcher = $rootScope.$on('articleTagsChanged', function (evt, article) {
                var articleElement = getArticleElement(article);
                if (articleElement) {
                    angular.element(articleElement).find('.js-article-tags')[0].innerHTML = articleHtml.renderTags(article);
                }
            });
            var articleReadStateChangedWatcher = $rootScope.$on('articleReadStateChanged', function (evt, article) {
                var articleElement = getArticleElement(article);
                if (articleElement) {
                    if (article.isRead) {
                        angular.element(articleElement).addClass('article--read');
                    } else {
                        angular.element(articleElement).removeClass('article--read');
                    }
                }
            });
            
            $scope.$on('$destroy', function () {
                // prevent memory leaks
                articleTagsChangedWatcher();
                articleReadStateChangedWatcher();
            });
            
            function render() {
                presentedArticles = $scope.presentedArticles;
                organizer.organizeByDays(presentedArticles);
                
                // render template
                
                var html = '';
                
                presentedArticles.forEach(function (art) {
                    
                    if (art.dayLabel) {
                        html += getDayLabelHtml(art);
                    }
                    
                    var t = articleHtml.renderArticle(articleTemplate, art, getArticleContentHtml(art));
                    
                    html += t;
                });
                
                $element.html(html);
                
                // add event bindings
                
                $element.find('.js-show-pick-tag-menu').click(function (evt) {
                    var article = getArticleForDomEvent(evt);
                    $scope.$emit('showPickTagMenu', article, evt.target);
                });
                
                $element.find('.js-toggle-is-read').click(function (evt) {
                    var article = getArticleForDomEvent(evt);
                    article.setIsRead(!article.isRead)
                    .then(function () {
                        
                    });
                });
            }
            
            $scope.$watch('presentedArticles', render);
            
            render();
        }
    };
});