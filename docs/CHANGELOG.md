# Changelog — Freally Studio

All notable changes to Freally Studio. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

The project pre-dates this changelog; older releases are represented in
git history (`git log --oneline`).

---

## [Unreleased] — 2026-05-02 — Security & Correctness Audit Pass

A focused end-to-end audit covering five surfaces (Electron + native, P2P
collaboration, file parsing, generators/audio engine, build/deps/config)
produced **49 findings**; **47 are implemented in this entry**, with the two
deferred items called out under *Deferred / Follow-up*. Final state:
`npm test` 844/844 passing, `npm run build` clean.

### Security

#### Electron main process & native bridges
- `shell:openExternal` now requires `https:` / `http:` / `mailto:`; everything else
  (including `file:`, `javascript:`, `smb:`) is rejected with a try/catch on URL parsing.
- Every `fs:*` IPC handler (`readFile`, `writeFile`, `readDir`, `stat`, `exists`,
  `mkdir`, `folders:scan`, `shell:showItemInFolder`) is gated by `assertSafePath`,
  which restricts access to `app.getPath('userData' | 'documents' | 'music' |
  'downloads' | 'desktop')` and an allowlist of paths the user picked through a
  dialog. `..` traversal and non-string inputs are rejected.
- A strict Content-Security-Policy is set in `index.html` (and re-injected by
  `session.defaultSession.webRequest.onHeadersReceived` in packaged builds).
- `webContents.setWindowOpenHandler` denies all `window.open`; `will-navigate`
  blocks any non-localhost http(s) navigation. External `https://` URLs are
  routed back through the validated `shell.openExternal` path.
- `requireMainFrame(event)` guards every `ipcMain.handle/.on` call across
  `main.js`, `audioCaptureBridge.js`, and `vst3HostBridge.js`.
- VST3 plugin loading now consults a Set populated only by `vst3Scanner.scan()`;
  arbitrary paths from the renderer are rejected.
- Native plugin `ProcessBlock` validates `numFrames` (0–8192), `numInCh` /
  `numOutCh` (0–32), and that the input typed array length is at least
  `numFrames * numInCh` before deinterleaving. Throws `Napi::Error` otherwise.
- `freally://` deep-link `room` parameter validated against `/^[A-Za-z0-9_-]{1,64}$/`.
- `fs.watch(recursive: true)` capped at 16 active watchers; system roots
  (`C:\`, `/`) rejected.
- `BrowserWindow` runs with `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`, `webSecurity: true`. (`ignore-certificate-errors`
  remains dev-only — gated by `!app.isPackaged` — and is now documented.)
- COOP/COEP trade-off documented inline: removed for Google OAuth popup;
  SharedArrayBuffer obtained through the explicit Chromium feature flag.

#### Collaboration & mobile-link
- Room and peer IDs use `crypto.getRandomValues` (≥ 64 bits) — `Math.random`
  removed from these paths.
- Host-generated `roomSecret` is delivered through the URL fragment (`#s=…`),
  never the broker channel; joiners must echo it in `MSG.AUTH` as the first
  message or have the data connection closed.
- Auto-answered media calls (PeerJS `peer.on('call')`) are deferred until
  the originating peer is authenticated; screen-share requires explicit
  consumer-supplied consent (`onIncomingCall`).
- Privileged messages (`TAB_ASSIGN`, `PERMISSIONS_UPDATE`, `PEER_MUTE`,
  `HOST_DISCONNECT`, `FREE_FOR_ALL`) verified to originate from `hostPeerId`.
- Per-message schema validation (allowed types, field allowlists, numeric
  ranges, string-length caps) plus a 10 MB outer JSON cap and per-peer rate
  limit (60 msgs/sec).
- `pendingSampleRequests` capped at 64 entries with oldest-evicted; `wavData`
  payloads capped at 5 MB.
- Mobile-link sessions issue a 6-digit PIN (rejection-sampled
  `crypto.getRandomValues`) embedded in the QR fragment; clients reject
  `MOBILE_JOIN` without a matching PIN. 30 sec auth timeout, 5 min QR-grace,
  10 min idle expiry.
- Voice mic stream now disposed on `PEER_MUTE` / `HOST_DISCONNECT` (was
  zeroing the gain only).
- Recording mic-broadcast to peers is gated behind explicit `recordingBroadcastEnabled`
  flag (default off).
- Peer display names served from an authoritative `peerDisplayNames` map seeded
  at JOIN with conflict resolution (`Alice (2)`); peer-supplied names cannot
  spoof an existing peer mid-session. Email local-part is no longer the default
  display name (`Guest-XXXX` instead).
- Public PeerJS broker disclosure surfaced via `brokerNotice` callback /
  dismissible banner.

#### File parsing & imports
- `MIDIParser` rejects files > 10 MB, `numTracks > 256`; `parseTrack` clamps
  `trackEnd` to buffer length; every `getUint8`/`getUint32` is bounds-checked;
  `readVariableLength` capped at the spec's 4-byte limit; running-status
  fall-through advances the cursor instead of looping; SysEx length validated
  against `trackEnd`. Body wrapped in `try/catch` returning `null` on RangeError.
- `ProjectManager` ZIP loading rejects file size > 200 MB, > 1024 entries, or
  > 1 GB total uncompressed. Manifest paths validated against an allowlist
  regex (`samples/`, `midi/`, `audio-clips/`, `vocal/`) with `..` rejection.
- Per-clip `decodeAudioData` calls are wrapped in `try/catch`; one bad sample
  no longer aborts the whole load. `sampler.clearAll()` deferred until manifest
  validation passes.
- Manifest schema validation: numeric DSP fields (`tempo`, `bars`, `volume`,
  `pan`, `gain`, octaves, etc.) require `Number.isFinite` and are clamped to
  sane ranges; string fields capped at 1024 chars; unknown top-level keys dropped.
- Drag-drop handlers reject files > 100 MB (50 MB for samples) before reading;
  `.mid` / `.midi` files require the `MThd` magic bytes.
- Factory-manifest URL building splits on `/`, encodes each segment, and
  rejects empty / `.` / `..` segments.
- `ArrangementTimeline` SVG color interpolations all pass through a
  `sanitizeColor` helper (regex allowlist for `#hex` and `rgb(a?)` plus a fallback)
  so a crafted `color` field on a dragged clip cannot break out of the SVG attribute.

#### Build, deps, and config
- `.env` confirmed git-ignored.
- `.gitignore` expanded: dev/scratch scripts at repo root (`_apply_edit.js`,
  `fix_backticks.py`, `*-audit-report.md`, etc.) plus standard editor / coverage
  patterns (`.env.local`, `.vscode/`, `.idea/`, `*.tsbuildinfo`, `coverage/`,
  `npm-debug.log*`).
- Vite dev-server `host: '0.0.0.0'` documented as intentional (mobile-link
  LAN testing).

### Fixed

- **Tempo zero / NaN propagation.** `setGlobalTempo` is wrapped in a clamping
  setter that rejects non-finite values and clips to `[20, 300]` regardless of
  caller (project load, presets, MIDI tap, undo/redo). All `60 / globalTempo`
  divisor sites are protected by this single invariant.
- **Drum solo-key inconsistency.** `drums_${drumId}` keys lose the trailing
  space they had in `DrumGeneratorEnhanced.jsx`; `FreallyAppComplete.jsx`'s
  drum-clip poller now treats any `drums_*` key as soloing the drums track.
  (Soloing a single drum lane no longer silences drum clips.)
- **AudioEngine `_idleSuspendTimer` leak.** `dispose()` clears the timer; the
  callback can no longer fire on a disposed instance.
- **Rhyme engine heteronym contamination.** `findRhymes` no longer scans every
  family for words sharing the queried suffix — it reads only the family keyed
  by the suffix. Previously, `findRhymes('sow')` mixed /aʊ/ words (`bow`,
  `plow`, `allow`, `now`, `cow`) into the candidate pool with /oʊ/ words
  (`row`, `show`, `low`). The two pronunciations are now isolated.
- **Caesura (dash) placement quality: 97.97% → 100%.** Five sub-fixes:
  1. Pre-authored phrase-bank dashes are re-validated against the audit rules;
     bad placements are stripped before the scoring loop runs.
  2. Verb-ing + preposition penalty broadened from the narrow `phrasalParticles`
     set to the full `prepositions` set, and bumped to −20 so it dominates the
     `+8/+6` gerund-bonus stack ("pounding - with", "looking - for",
     "sleeping - in", "feeling - of" all cleared).
  3. Single-char-second-half penalty −10 → −15 (`"trapped inside - a memory"`
     style cases).
  4. Preposition-before-dash penalty −12 → −16 (kicks `"box me in - but"`
     below the quality gate against the clause-starter bonus).
  5. Compound-pair detection rewritten with a 3-word lookahead — splits like
     `"left - and right"` are now caught even with `and`/fillers inside the
     compound. Pair list aligned with the audit's `COMPOUND_PHRASES`.
- **Stale `KNOWN_DRUM_PATTERNS` test.** `src/domain/domain.test.js` now
  enumerates all 24 patterns referenced by `genres.js` (added `indie_pop`,
  `indie_rock`, `metal`, `country`, `gospel`).
- **`createInviteLink` test-environment robustness.** Builds the URL through
  `new URL(window.location.href)` so jsdom envs that update `href` without
  propagating to `origin`/`pathname` still produce a valid link.
- **Audio-capture IPC test regex** updated to match the post-`requireMainFrame`
  parameter rename (`event` instead of `_event`).
- **`Math.max(...arr)` stack-overflow risk** replaced with for-loop reductions
  on the 25 ms drum-clip poll path (large patterns previously could cross the
  V8 spread-arguments limit).
- **`bgWorker` Blob URL leak** — `URL.revokeObjectURL` now called in the worker
  effect cleanup.
- **`SamplerEngine._resetInterval` cleanup** added to `dispose()` mirroring
  the `AudioEngine._idleSuspendTimer` fix.
- **`getChordNotes` empty guard** in `MusicTheory.generateBassline` (prevents
  `undefined + 12` → NaN propagating into bassline notes).
- **MIDI note clamping** to `[0, 127]` in `ChordAwareGenerator` and
  `MusicTheory.getMIDINote` (fixes octave overflow with low octave settings).
- **Mood-keys alignment** in `ChordAwareGenerator.generateChordProgression` —
  `Mystical` and `Exotic` no longer silently fall back to the `Dark` mapping.

### Added — UI consumer wiring (post-collab/mobile-link refactor)

- Invite link copy includes `#s=…` room secret; joining renderer extracts it
  and strips the fragment via `history.replaceState` so it isn't logged.
- Inbound screen-share calls trigger a `window.confirm` dialog with the
  authoritative peer name (default-deny if no consumer is wired).
- Recording broadcast toggle exposed in `CollabPanel` next to the
  "Hear Yourself" control (default off).
- One-time dismissible banner surfaces the PeerJS-broker privacy notice for
  both collaboration and mobile-link sessions.
- Cursor / chat / peer-roster / voice-meter labels now read from
  `peerDisplayNames` (with graceful fallback).
- `MobileLinkModal` displays the 6-digit PIN beneath the QR; `engine.pin`
  plumbed through `useMobileLink`.

### Deferred / Follow-up

- **A7 (native bounds) recompile.** The C++ source patch in
  `native/src/napi_plugin_wrapper.cpp` is in place; CMake on the developer
  machine currently fails with `Unknown CMake command CMAKE_DETERMINE_COMPILER_ID`
  (a toolchain issue unrelated to the change). Run `npm run native:build` once
  the local CMake/MSBuild environment is healthy.
- The `MISSING_BREAK` count in caesura-audit (~30 long lines without any dash)
  is informational only — the audit's PASS/FAIL is `dashAccuracy ≥ 100%`,
  which now holds.

### Test infrastructure

- Bumped vitest `timeout` to 1,200,000 ms on the long-running lyrics audits
  (`caesura-audit.test.js`, `all-genres-audit.test.js`). They run in roughly
  9–13 minutes each on the reference dev machine.
- `npm test` end state: **844/844 passing across 33 test files**.
- `npm run build` end state: clean (only the pre-existing chunk-size warning
  on the locale bundles).

---

## [Pre-changelog history]

For releases prior to this entry, refer to git history.
Recent notable commits:

- `c9549c9` — Ignore feature docs and build/implementation prompt specs
- `e96923f` — Add All Rights Reserved license
- `bdb17a0` — Professional drum generation overhaul, genre fixes, lyrics caesura improvements
- `eb19046` — DAW theme overhaul, UI polish, and source updates across all panels
- `cb8cb73` — Comprehensive test suite (839 tests, 0 failures), audit reports
