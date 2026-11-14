'use strict';

var fs = require('fs');
var path = require('path');
var pathToFileURL = require('url').pathToFileURL;

var rootDirectory = path.resolve(__dirname, '..');
var appDirectory = path.join(rootDirectory, 'app');
var outputDirectory = path.join(rootDirectory, 'release', 'windows');
var cacheDirectory = path.join(rootDirectory, '.cache', 'nwjs');
var appManifest = require(path.join(appDirectory, 'package.json'));
var nwbuildOptions = appManifest.nwbuild || {};

async function build() {
    fs.mkdirSync(outputDirectory, { recursive: true });

    var nwBuilderEntry = require.resolve('nw-builder', { paths: [appDirectory] });
    var nwbuild = (await import(pathToFileURL(nwBuilderEntry).href)).default;
    var installerPath = await nwbuild({
        mode: 'package',
        srcDir: appDirectory,
        outDir: outputDirectory,
        cacheDir: cacheDirectory,
        glob: false,
        ...nwbuildOptions,
        app: {
            ...nwbuildOptions.app,
            icon: path.resolve(appDirectory, nwbuildOptions.app.icon),
            fileVersion: appManifest.version,
            productVersion: appManifest.version
        },
        nsis: {
            ...nwbuildOptions.nsis,
            makensisPath: process.env.MAKENSIS_PATH || 'makensis'
        }
    });

    if (typeof installerPath !== 'string' || path.extname(installerPath).toLowerCase() !== '.exe') {
        throw new Error('NW.js packaging did not return a Windows installer executable.');
    }
    if (!fs.existsSync(installerPath) || fs.statSync(installerPath).size === 0) {
        throw new Error('The Windows installer was not created: ' + installerPath);
    }

    var finalInstallerPath = path.join(outputDirectory, path.basename(installerPath));
    if (path.resolve(installerPath) !== path.resolve(finalInstallerPath)) {
        fs.copyFileSync(installerPath, finalInstallerPath);
        fs.unlinkSync(installerPath);
    }
    if (!fs.existsSync(finalInstallerPath) || fs.statSync(finalInstallerPath).size === 0) {
        throw new Error('The Windows installer was not created: ' + finalInstallerPath);
    }

    console.log('Windows installer created: ' + finalInstallerPath);
}

build().catch(function (error) {
    console.error('Windows build failed:', error);
    process.exitCode = 1;
});
