'use strict'

var Q = require('q');
var fs = require('fs');
var pathUtil = require('path');
var crypto = require('crypto');

exports.init = function (waitingPlacePath) {
    
    function storeOne(url, data) {
        var def = Q.defer();
        
        var name = crypto.pseudoRandomBytes(8).toString('hex');
        var dataPath = pathUtil.resolve(waitingPlacePath, name);
        var urlBuffer = Buffer.from(String(url), 'utf8');
        if (urlBuffer.length > 65535) {
            def.reject(new RangeError('Feed URL is too long to store.'));
            return def.promise;
        }
        var buf = Buffer.alloc(2 + urlBuffer.length);
        buf.writeUInt16BE(urlBuffer.length, 0);
        urlBuffer.copy(buf, 2);
        fs.writeFile(dataPath, Buffer.concat([buf, data]), function (err) {
            if (err) {
                def.reject(err);
                return;
            }
            def.resolve();
        });
        
        return def.promise;
    }
    
    function getOne() {
        var def = Q.defer();
        
        fs.readdir(waitingPlacePath, function (err, files) {
            if (err) {
                def.reject(err);
                return;
            }
            if (files.length > 0) {
                var dataPath = pathUtil.resolve(waitingPlacePath, files[0]);
                fs.readFile(dataPath, function (err, buf) {
                    if (err) {
                        def.reject(err);
                        return;
                    }
                    if (buf.length < 2) {
                        def.reject(new Error('Queued feed data is invalid.'));
                        return;
                    }
                    var urlLen = buf.readUInt16BE(0);
                    if (buf.length < 2 + urlLen) {
                        def.reject(new Error('Queued feed data is incomplete.'));
                        return;
                    }
                    var url = buf.toString('utf8', 2, 2 + urlLen);
                    fs.unlink(dataPath, function (err) {
                        if (err) {
                            def.reject(err);
                            return;
                        }
                        def.resolve({
                            url: url,
                            data: buf.slice(2 + urlLen)
                        });
                    });
                });
            } else {
                var emptyError = new Error('No feeds are waiting to be parsed.');
                emptyError.code = 'EMPTY_QUEUE';
                def.reject(emptyError);
            }
        });
        
        return def.promise;
    }
    
    if (!fs.existsSync(waitingPlacePath)) {
        fs.mkdirSync(waitingPlacePath);
    }
    
    return {
        storeOne: storeOne,
        getOne: getOne
    };
};