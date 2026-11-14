'use strict';

var Q = require('q');
var axios = require('axios');

exports.getUrl = function (url, options) {
    options = options || {};

    return Q(axios.get(url, {
        timeout: options.timeout || 20000,
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Sputnik News Reader',
            'Accept-Encoding': 'gzip, deflate'
        },
        validateStatus: function () {
            return true;
        }
    })).then(function (response) {
        if (response.status === 404) {
            return Q.reject({ code: '404' });
        }
        if (response.status !== 200) {
            return Q.reject({ code: 'unknownError' });
        }
        return response.data;
    });
};