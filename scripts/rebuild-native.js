/**
 * Pre-build script for electron-builder.
 * Rebuilds the native VST3 host addon for the target Electron ABI/architecture.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
    const nativeDir = path.join(__dirname, '..', 'native');

    // Check if native directory exists
    if (!fs.existsSync(path.join(nativeDir, 'CMakeLists.txt'))) {
        console.log('[rebuild-native] No native/CMakeLists.txt found, skipping native build.');
        return;
    }

    // Check if node_modules are installed
    if (!fs.existsSync(path.join(nativeDir, 'node_modules'))) {
        console.log('[rebuild-native] Installing native dependencies...');
        execSync('npm install', {
            cwd: nativeDir,
            stdio: 'inherit',
        });
    }

    const platform = context.platform.name;
    const arch = context.arch;
    console.log(`[rebuild-native] Building native addon for ${platform}-${arch}`);

    try {
        execSync('npm run build', {
            cwd: nativeDir,
            stdio: 'inherit',
            env: {
                ...process.env,
                npm_config_target: process.versions.electron,
                npm_config_arch: arch,
                npm_config_target_arch: arch,
                npm_config_runtime: 'electron',
            },
        });
        console.log('[rebuild-native] Native addon built successfully.');
    } catch (err) {
        console.error('[rebuild-native] Native addon build failed:', err.message);
        console.error('[rebuild-native] Continuing without native VST3 support.');
    }
};
