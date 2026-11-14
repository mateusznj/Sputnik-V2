'use strict';

var sanitizeHtml = require('sanitize-html');

exports.httpUrl = function (value) {
    var url = String(value === undefined || value === null ? '' : value).trim();
    try {
        var parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
    } catch (error) {
        return '';
    }
};

exports.sanitize = function (html) {
    return sanitizeHtml(String(html || ''), {
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesByTag: {
            img: ['http', 'https']
        },
        allowProtocolRelative: false,
        transformTags: {
            img: function (tagName, attribs) {
                return {
                    tagName: tagName,
                    attribs: Object.assign({}, attribs, { loading: 'lazy' })
                };
            }
        }
    });
};
