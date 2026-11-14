'use strict';

function initSputnikConfig() {
    
    var fs = require('fs');
    var gui = window.nw;
    
    var appConf = JSON.parse(fs.readFileSync('./appConfig.json'));
    
    var dataHomeFolder = appConf.dataHomeFolder;
    if (appConf.targetPlatform === 'macos') {
        dataHomeFolder = gui.App.dataPath;
    } else {
        dataHomeFolder = '../data';
    }
    
    if (!fs.existsSync(dataHomeFolder)) {
        fs.mkdirSync(dataHomeFolder);
    }
    
    var userConf = {};
    var userConfPath = dataHomeFolder + '/config.json';
    if (fs.existsSync(userConfPath)) {
        userConf = JSON.parse(fs.readFileSync(userConfPath));
    }
    
    function setUserConfProperty(key, value) {
        userConf[key] = value;
        fs.writeFileSync(userConfPath, JSON.stringify(userConf, null, 4), { encoding: 'utf8' });
    }
    
    // default values
    
    if (Object.prototype.hasOwnProperty.call(userConf, 'guid')) {
        delete userConf.guid;
        fs.writeFileSync(userConfPath, JSON.stringify(userConf, null, 4), { encoding: 'utf8' });
    }
    localStorage.removeItem('guid');
    
    if (userConf.articlesPerPage === undefined) {
        setUserConfProperty('articlesPerPage', 30);
    }
    
    if (userConf.keepArticlesForMonths === undefined) {
        setUserConfProperty('keepArticlesForMonths', 12);
    }
    
    if (userConf.keepTaggedArticlesForever === undefined) {
        setUserConfProperty('keepTaggedArticlesForever', true);
    }
    
    return  {
        get version() {
            return gui.App.manifest.version;
        },
        get dataHomeFolder() {
            return dataHomeFolder;
        },
        
        get targetPlatform() {
            return appConf.targetPlatform;
        },
        get websiteUrl() {
            return appConf.websiteUrl;
        },
        get websiteUrlDonate() {
            return appConf.websiteUrlDonate;
        },
        get articlesPerPage() {
            return userConf.articlesPerPage;
        },
        set articlesPerPage(value) {
            setUserConfProperty('articlesPerPage', value);
        },
        get lastFeedsDownload() {
            return userConf.lastFeedsDownload;
        },
        set lastFeedsDownload(value) {
            setUserConfProperty('lastFeedsDownload', value);
        },
        get keepArticlesForMonths() {
            return userConf.keepArticlesForMonths;
        },
        set keepArticlesForMonths(value) {
            setUserConfProperty('keepArticlesForMonths', value);
        },
        get keepTaggedArticlesForever() {
            return userConf.keepTaggedArticlesForever;
        },
        set keepTaggedArticlesForever(value) {
            setUserConfProperty('keepTaggedArticlesForever', value);
        },
    };
}