/**
 * Build script for the native VST3 host addon.
 * Auto-detects CMake from Visual Studio if not on PATH.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildType = process.argv.includes('--debug') ? 'Debug' : 'Release';

function findCMake() {
    try {
        execSync('cmake --version', { stdio: 'pipe' });
        return null; // cmake-js will find it on PATH
    } catch (_) {}

    if (process.platform === 'win32') {
        const vsBase = 'C:\\Program Files\\Microsoft Visual Studio';
        const years = ['18', '2022', '2019', '2017'];
        const editions = ['Community', 'Professional', 'Enterprise', 'BuildTools'];
        for (const year of years) {
            for (const edition of editions) {
                const p = path.join(vsBase, year, edition,
                    'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe');
                if (fs.existsSync(p)) return p;
            }
        }
    }
    return null;
}

const cmakePath = findCMake();
const cmakeFlag = cmakePath ? ` --cmake-path="${cmakePath}"` : '';
const cmd = `npx cmake-js build --CDCMAKE_BUILD_TYPE=${buildType}${cmakeFlag}`;

console.log(`[native] Building VST3 host addon (${buildType})...`);
if (cmakePath) console.log(`[native] Using CMake: ${cmakePath}`);

try {
    execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
    console.log('[native] Build succeeded.');
} catch (err) {
    console.error('[native] Build failed.');
    process.exit(1);
}
