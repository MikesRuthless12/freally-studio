/**
 * Detects CMake path on Windows, checking PATH first, then Visual Studio installations.
 * Returns the cmake path for use with cmake-js --cmake-path flag.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findCMake() {
    // 1. Check if cmake is on PATH
    try {
        execSync('cmake --version', { stdio: 'pipe' });
        return 'cmake'; // On PATH, cmake-js will find it
    } catch (_) {}

    // 2. Check Visual Studio installations (newest first)
    if (process.platform === 'win32') {
        const vsBase = 'C:\\Program Files\\Microsoft Visual Studio';
        const years = ['18', '2022', '2019', '2017'];
        const editions = ['Community', 'Professional', 'Enterprise', 'BuildTools'];

        for (const year of years) {
            for (const edition of editions) {
                const cmakePath = path.join(
                    vsBase, year, edition,
                    'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe'
                );
                if (fs.existsSync(cmakePath)) {
                    return cmakePath;
                }
            }
        }
    }

    return null;
}

const cmakePath = findCMake();
if (cmakePath && cmakePath !== 'cmake') {
    // Output cmake-js flag for use in scripts
    process.stdout.write(`--cmake-path="${cmakePath}"`);
} else if (!cmakePath) {
    process.stderr.write('ERROR: CMake not found. Install CMake or Visual Studio with C++ workload.\n');
    process.exit(1);
}
