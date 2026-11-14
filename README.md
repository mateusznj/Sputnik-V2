# Sputnik

Open-source RSS and Atom reader built with [NW.js](https://nwjs.io/) and Preact.

##License (GPLv3)
Copyright (C) 2013 Jakub Szwacz <sputnik@szwacz.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

## Privacy and updates

Sputnik does not send usage telemetry or check for updates automatically. Feeds and
their images are still downloaded from the URLs configured by the user. Check the
[GitHub releases](https://github.com/dz0ny/sputnik/releases) page for updates.

## Development

The app uses Preact. End users do not need Node.js; the Windows installer
includes the NW.js runtime. To build the installer, the build machine needs
Node.js 22 or newer and NSIS. From the repository root:

```text
cd app
npm ci
npm test
npm run build:windows
```

The installer is written to `release/windows/Sputnik-x64-Setup.exe`. The script
downloads the pinned NW.js runtime and packages the app with NSIS. The same
process runs on Windows in GitHub Actions for manual builds and `v*` tags; the
installer is published there as a downloadable workflow artifact and attached
to GitHub releases created from `v*` tags.