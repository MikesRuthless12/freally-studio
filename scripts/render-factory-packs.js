// render-factory-packs.js — renders the curated starter packs (TASK-B05)
//
// Run with:  node scripts/render-factory-packs.js
//
// Output goes under public/"Factory Library"/Freally Packs/<Folder>/*.wav
// (the in-app Factory Library loader reads /factory-manifest.json whose tree
// is rooted at /Factory Library — public/factory-packs/ would be invisible
// to it). The script then merges a "Freally Packs" top-level folder into
// public/factory-manifest.json, replacing any previous run.
//
// ───────────────────────── CURATION LIST ─────────────────────────
// Trap Essentials : Trap Kick, Trap 808 (F1/A1/C2 grid), Trap Snare,
//                   Trap Ghost, Trap Clap, Trap CH, Trap OH   × 2 round-robins
// House Basics    : House Kick, House Snare, House Clap, House CH, House OH
//                   × 2 round-robins
// Boom Bap Cuts   : Boom Bap Kick, Boom Bap Snare, Boom Bap Clap, Lo-Fi CH,
//                   Soft Ghost                                 × 2 round-robins
// ──────────────────────────────────────────────────────────────────

import { OfflineAudioContext } from 'node-web-audio-api';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

globalThis.OfflineAudioContext = OfflineAudioContext;

const { renderPack } = await import('../src/packfactory/PackRenderer.js');
const { layoutPack } = await import('../src/packfactory/PackNaming.js');
const { PRESETS, getDefaults } = await import('../src/DrumSynthEngine.js');

const item = (type, presetName) => {
    const preset = PRESETS[type].find(p => p.name === presetName);
    if (!preset) throw new Error(`Unknown preset ${type}/${presetName}`);
    return {
        kind: 'drum', type, name: preset.name, genre: preset.genre ?? null,
        params: { ...getDefaults(type), ...preset.params },
    };
};

const PACKS = [
    {
        name: 'Trap Essentials',
        variations: 2,
        items: [
            item('kick', 'Trap Kick'), item('snare', 'Trap Snare'),
            item('ghostSnare', 'Trap Ghost'), item('clap', 'Trap Clap'),
            item('closedHat', 'Trap CH'), item('openHat', 'Trap OH'),
        ],
        melodic: { item: item('808', 'Trap 808'), pitchGrid: [29, 33, 36] }, // F1 A1 C2
    },
    {
        name: 'House Basics',
        variations: 2,
        items: [
            item('kick', 'House Kick'), item('snare', 'House Snare'),
            item('clap', 'House Clap'), item('closedHat', 'House CH'),
            item('openHat', 'House OH'),
        ],
    },
    {
        name: 'Boom Bap Cuts',
        variations: 2,
        items: [
            item('kick', 'Boom Bap Kick'), item('snare', 'Boom Bap Snare'),
            item('clap', 'Boom Bap Clap'), item('closedHat', 'Lo-Fi CH'),
            item('ghostSnare', 'Soft Ghost'),
        ],
    },
];

const publicDir = join(import.meta.dirname, '..', 'public');
const rootDirName = 'Freally Packs';
const rootDir = join(publicDir, 'Factory Library', rootDirName);

const manifestFolders = [];

for (const pack of PACKS) {
    console.log(`Rendering "${pack.name}"…`);
    let results = await renderPack({
        items: pack.items,
        variations: pack.variations,
        onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total}`),
    });
    if (pack.melodic) {
        const melodic = await renderPack({
            items: [pack.melodic.item],
            pitchGrid: pack.melodic.pitchGrid,
            variations: pack.variations,
        });
        results = results.concat(melodic);
    }
    process.stdout.write('\n');

    const { files } = layoutPack(results, { packName: pack.name });
    const byFolder = {};
    for (const f of files) {
        const [folderName, fileName] = f.path.split('/');
        const dir = join(rootDir, pack.name, folderName);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, fileName), Buffer.from(f.bytes));
        (byFolder[folderName] = byFolder[folderName] || []).push(fileName);
    }
    manifestFolders.push({
        name: pack.name,
        path: `Factory Library/${rootDirName}/${pack.name}`,
        children: Object.entries(byFolder).map(([folderName, fileNames]) => ({
            name: folderName,
            path: `Factory Library/${rootDirName}/${pack.name}/${folderName}`,
            files: fileNames.sort(),
        })),
    });
    console.log(`  ${files.length} files → ${join(rootDir, pack.name)}`);
}

// merge into factory-manifest.json (replace any previous "Freally Packs")
const manifestPath = join(publicDir, 'factory-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.folders = (manifest.folders || []).filter(f => f.name !== rootDirName);
manifest.folders.push({
    name: rootDirName,
    path: `Factory Library/${rootDirName}`,
    children: manifestFolders,
});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));
console.log(`Manifest updated: ${manifestPath}`);
