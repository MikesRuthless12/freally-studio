/**
 * VST3 Plugin Scanner
 *
 * Scans filesystem for VST3 plugin bundles across platform-specific default
 * paths plus up to 3 user-defined custom paths. Extracts metadata from
 * moduleinfo.json (modern VST3 standard) or falls back to bundle name parsing.
 *
 * Sends progress updates to the renderer via IPC for real-time progress bar.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class VST3Scanner {
    constructor(userDataPath) {
        this.userDataPath = userDataPath;
        this.settingsPath = path.join(userDataPath, 'vst3-settings.json');
        this.cachePath = path.join(userDataPath, 'vst3-cache.json');
        this.progressCallback = null;
    }

    /**
     * Set callback for progress updates
     * @param {Function} callback - (progress) => void where progress = { scanned, total, percent, currentFile }
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Get platform-specific default VST3 scan directories
     */
    getDefaultPaths() {
        const platform = process.platform;
        const home = os.homedir();

        switch (platform) {
            case 'win32':
                return [
                    'C:\\Program Files\\Common Files\\VST3',
                    path.join(home, 'AppData', 'Local', 'Programs', 'Common', 'VST3'),
                ];
            case 'darwin':
                return [
                    '/Library/Audio/Plug-Ins/VST3',
                    path.join(home, 'Library', 'Audio', 'Plug-Ins', 'VST3'),
                ];
            case 'linux':
                return [
                    path.join(home, '.vst3'),
                    '/usr/lib/vst3',
                    '/usr/local/lib/vst3',
                ];
            default:
                return [];
        }
    }

    /**
     * Get user-defined custom scan paths
     */
    getCustomPaths() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
                return (data.customPaths || []).filter(p => p && p.trim().length > 0);
            }
        } catch (err) {
            console.error('Failed to read VST3 settings:', err.message);
        }
        return [];
    }

    /**
     * Save custom scan paths
     */
    setCustomPaths(paths) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.settingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            // Keep exactly 3 slots, pad with empty strings
            const padded = [
                paths[0] || '',
                paths[1] || '',
                paths[2] || '',
            ];
            fs.writeFileSync(this.settingsPath, JSON.stringify({ customPaths: padded }, null, 2));
        } catch (err) {
            console.error('Failed to save VST3 settings:', err.message);
        }
    }

    /**
     * Recursively find all .vst3 bundles in a directory
     */
    async findVST3Bundles(dirPath) {
        const bundles = [];
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.name.toLowerCase().endsWith('.vst3')) {
                    bundles.push(fullPath);
                } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    // Don't recurse into .vst3 bundles themselves
                    const nested = await this.findVST3Bundles(fullPath);
                    bundles.push(...nested);
                }
            }
        } catch (err) {
            // Directory not readable — skip silently
        }
        return bundles;
    }

    /**
     * Extract metadata from a single VST3 bundle
     */
    async extractPluginInfo(bundlePath) {
        const bundleName = path.basename(bundlePath, '.vst3');
        const info = {
            name: bundleName,
            vendor: 'Unknown',
            version: '',
            categories: [],
            path: bundlePath,
            uid: '',
            inputs: 0,
            outputs: 2,
            hasMidiInput: false,
            valid: true,
        };

        try {
            // Try to read moduleinfo.json (VST3 3.7.1+ standard)
            const moduleInfoPaths = [
                path.join(bundlePath, 'Contents', 'moduleinfo.json'),
                path.join(bundlePath, 'Contents', 'Resources', 'moduleinfo.json'),
                // Windows flat layout
                path.join(bundlePath, 'moduleinfo.json'),
            ];

            for (const miPath of moduleInfoPaths) {
                try {
                    if (fs.existsSync(miPath)) {
                        const raw = await fs.promises.readFile(miPath, 'utf8');
                        const moduleInfo = JSON.parse(raw);

                        if (moduleInfo.Name) info.name = moduleInfo.Name;
                        if (moduleInfo.Vendor) info.vendor = moduleInfo.Vendor;
                        if (moduleInfo.Version) info.version = moduleInfo.Version;
                        if (moduleInfo['Factory Info']?.Vendor) info.vendor = moduleInfo['Factory Info'].Vendor;

                        // Extract classes info
                        if (moduleInfo.Classes && moduleInfo.Classes.length > 0) {
                            const cls = moduleInfo.Classes[0];
                            if (cls.Name) info.name = cls.Name;
                            if (cls.Vendor) info.vendor = cls.Vendor;
                            if (cls.Version) info.version = cls.Version;
                            if (cls.CID) info.uid = cls.CID;

                            // Parse categories/subcategories
                            if (cls['Sub Categories']) {
                                info.categories = cls['Sub Categories']
                                    .split('|')
                                    .map(c => c.trim())
                                    .filter(Boolean);
                            } else if (cls.Category) {
                                info.categories = [cls.Category];
                            }
                        }

                        // Check for additional classes (multi-plugin bundles)
                        if (moduleInfo.Classes && moduleInfo.Classes.length > 1) {
                            // First audio class is the main plugin
                            for (const cls of moduleInfo.Classes) {
                                const cats = cls['Sub Categories'] || cls.Category || '';
                                if (cats.includes('Instrument') || cats.includes('Fx')) {
                                    if (cls.Name) info.name = cls.Name;
                                    if (cls.Vendor) info.vendor = cls.Vendor;
                                    if (cls.Version) info.version = cls.Version;
                                    if (cls.CID) info.uid = cls.CID;
                                    if (cls['Sub Categories']) {
                                        info.categories = cls['Sub Categories']
                                            .split('|')
                                            .map(c => c.trim())
                                            .filter(Boolean);
                                    }
                                    break;
                                }
                            }
                        }

                        break; // Found valid moduleinfo
                    }
                } catch {
                    // Try next path
                }
            }

            // Determine category type for grouping
            const catString = info.categories.join(' ').toLowerCase();
            if (catString.includes('instrument') || catString.includes('synth') || catString.includes('sampler')) {
                info.hasMidiInput = true;
            }

            // Generate UID from path if none found
            if (!info.uid) {
                info.uid = bundlePath;
            }

        } catch (err) {
            info.valid = false;
            console.error(`Failed to parse VST3 bundle: ${bundlePath}`, err.message);
        }

        return info;
    }

    /**
     * Get the high-level category for grouping in the UI
     */
    static getDisplayCategory(plugin) {
        const cats = (plugin.categories || []).join(' ').toLowerCase();
        if (cats.includes('instrument') || cats.includes('synth') || cats.includes('sampler') || cats.includes('generator')) {
            return 'Instruments';
        }
        if (cats.includes('fx') || cats.includes('effect') || cats.includes('reverb') ||
            cats.includes('delay') || cats.includes('compressor') || cats.includes('eq') ||
            cats.includes('filter') || cats.includes('distortion') || cats.includes('dynamics') ||
            cats.includes('modulation') || cats.includes('chorus') || cats.includes('phaser') ||
            cats.includes('flanger')) {
            return 'Effects';
        }
        if (cats.includes('analyzer') || cats.includes('meter') || cats.includes('tool') || cats.includes('utility')) {
            return 'Utilities';
        }
        // Default: if it has MIDI input, treat as instrument
        if (plugin.hasMidiInput) {
            return 'Instruments';
        }
        return 'Effects';
    }

    /**
     * Load cached scan results
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
                return data;
            }
        } catch (err) {
            console.error('Failed to load VST3 cache:', err.message);
        }
        return null;
    }

    /**
     * Save scan results to cache
     */
    saveCache(plugins, scanPaths) {
        try {
            const dir = path.dirname(this.cachePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const cacheData = {
                timestamp: Date.now(),
                scanPaths,
                plugins,
            };
            fs.writeFileSync(this.cachePath, JSON.stringify(cacheData, null, 2));
        } catch (err) {
            console.error('Failed to save VST3 cache:', err.message);
        }
    }

    /**
     * Clear the scan cache
     */
    clearCache() {
        try {
            if (fs.existsSync(this.cachePath)) {
                fs.unlinkSync(this.cachePath);
            }
        } catch (err) {
            console.error('Failed to clear VST3 cache:', err.message);
        }
    }

    /**
     * Full scan of all directories (default + custom)
     * Sends progress updates via callback during scan.
     * @param {boolean} forceRescan - Bypass cache
     * @returns {Array} Array of plugin info objects
     */
    async scan(forceRescan = false) {
        const defaultPaths = this.getDefaultPaths();
        const customPaths = this.getCustomPaths();
        const allPaths = [...defaultPaths, ...customPaths];

        // Check cache validity
        if (!forceRescan) {
            const cache = this.loadCache();
            if (cache && cache.plugins) {
                // Check if scan paths haven't changed
                const cachedPaths = (cache.scanPaths || []).sort().join('|');
                const currentPaths = allPaths.sort().join('|');
                if (cachedPaths === currentPaths) {
                    // Cache is still valid for same paths
                    this._sendProgress(cache.plugins.length, cache.plugins.length, 'Loaded from cache');
                    return cache.plugins;
                }
            }
        }

        // Phase 1: Discover all .vst3 bundles
        this._sendProgress(0, 0, 'Discovering plugins...');
        const allBundles = [];
        const seen = new Set();

        for (const scanPath of allPaths) {
            if (!scanPath || !fs.existsSync(scanPath)) continue;
            const bundles = await this.findVST3Bundles(scanPath);
            for (const b of bundles) {
                const normalized = b.replace(/\\/g, '/').toLowerCase();
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    allBundles.push(b);
                }
            }
        }

        const total = allBundles.length;
        this._sendProgress(0, total, total > 0 ? `Found ${total} plugins, scanning...` : 'No VST3 plugins found');

        if (total === 0) {
            this.saveCache([], allPaths);
            return [];
        }

        // Phase 2: Extract metadata from each bundle with progress
        const plugins = [];
        for (let i = 0; i < allBundles.length; i++) {
            const bundlePath = allBundles[i];
            const bundleName = path.basename(bundlePath, '.vst3');

            this._sendProgress(i, total, bundleName);

            try {
                const info = await this.extractPluginInfo(bundlePath);
                if (info.valid) {
                    plugins.push(info);
                }
            } catch (err) {
                // Skip invalid plugins silently
                console.error(`Skipping invalid plugin: ${bundlePath}`, err.message);
            }
        }

        // Final progress
        this._sendProgress(total, total, `Scan complete: ${plugins.length} plugins found`);

        // Save to cache
        this.saveCache(plugins, allPaths);

        return plugins;
    }

    /**
     * Send progress update
     */
    _sendProgress(scanned, total, currentFile) {
        const percent = total > 0 ? ((scanned / total) * 100) : 0;
        const progress = {
            scanned,
            total,
            percent: parseFloat(percent.toFixed(2)),
            percentStr: percent.toFixed(2) + '%',
            currentFile: currentFile || '',
            done: total > 0 && scanned >= total,
        };
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
    }
}

module.exports = { VST3Scanner };
