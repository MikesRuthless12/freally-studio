# 🌊 WavLoom Studio v2.0 - Enhanced

Professional browser-based DAW with comprehensive music production features.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- pnpm package manager (or npm/yarn)

### Installation

1. **Extract the project files**
   ```bash
   unzip WavLoom-Enhanced-v2.zip
   cd wavloom-project
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Start development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

4. **Open in browser**
   - Navigate to `http://localhost:5173`
   - The application will automatically open

---

## 🎯 Features Overview

### 🎬 Arrangement View
Professional DAW-style timeline with multi-track editing:
- **Spacebar**: Play/Stop
- **Ctrl+Space**: Play from start
- **Ctrl+L**: Toggle loop
- **[** and **]**: Set loop start/end
- **Delete**: Remove selected clip
- **Ctrl+D**: Duplicate clip
- Drag clips to reposition
- Right-click clips for effects menu
- Visual waveforms and playhead
- Zoom controls

### 🎛️ Mixer View
FL Studio-style professional mixer:
- Vertical channel strips with VU meters
- Click **"+"** to add plugins to any channel
- Solo/Mute buttons with LED indicators
- Pan and volume faders
- Master channel with dedicated processing
- Color-coded channels
- Plugin drag & drop

### 🎹 MIDI Sequencer (In Development)
- 35+ music genres with professional characteristics
- Pattern learning from imported MIDI/samples
- Pro-level drum, melody, and chord generation
- C0-C8 full range support
- Grid snapping (1/4, 1/8, 1/16, 1/32)
- 1-8 bar patterns

---

## 📁 Project Structure

```
wavloom-project/
├── src/
│   ├── App.jsx                      # Original app
│   ├── AppDemo.jsx                  # Enhanced demo app
│   ├── ArrangementViewEnhanced.jsx  # DAW arrangement view
│   ├── ModernMixer.jsx              # FL Studio-style mixer
│   ├── GenreDefinitions.js          # 35+ genre database
│   ├── PatternAnalyzer.js           # MIDI/audio analysis
│   ├── PatternLearner.js            # AI pattern learning
│   ├── AudioClipEditor.js           # Audio editing tools
│   ├── ClipPresets.js               # Sample presets (808s, kicks, etc.)
│   ├── SampleDatabase.js            # IndexedDB storage
│   ├── FolderTreeBrowser.jsx        # File browser with tagging
│   ├── DrumSampleManager.jsx        # Drum sample assignment
│   ├── WindowControls.jsx           # Window management
│   ├── themes.js                    # Dark/Light themes
│   └── ... (original files)
├── package.json
├── vite.config.js
├── index.html
├── FEATURES_IMPLEMENTED.md          # Complete feature list
└── README.md                        # This file
```

---

## 🎨 New Components

### 1. **GenreDefinitions.js** (35+ Genres)
Complete genre database with professional characteristics:
- **Urban**: Trap, Hip Hop, Drill, Lo-Fi, Grime, Jersey Club
- **Electronic**: House, Techno, Drum & Bass, Dubstep, Trance, Future Bass, Garage, IDM, Synthwave, Vaporwave, Breakbeat, Hardstyle, Footwork
- **World/Latin**: Reggaeton, Afrobeat, Reggae, Samba
- **Jazz/Funk/Soul**: Jazz, Funk, Soul, Neo-Soul
- **Rock**: Rock, Metal, Punk
- **Ambient**: Ambient
- **Pop/Commercial**: Pop, R&B

### 2. **Pattern Learning System**
- Analyze imported MIDI/audio files
- Learn patterns and generate variations
- "Generate Like This" feature
- Adjustable similarity control

### 3. **Audio Clip Editor**
Professional audio editing:
- Reverse, Time Stretch, Pitch Shift
- Trim, Crop, Fade In/Out
- Normalize, Loop, Slice
- WAV export

### 4. **Sample Presets**
Professional presets for:
- 808 Bass, Kick, Snare, Hi-Hat, Clap
- Vocals, Bass, Lead, Pad, Tom
- FX/Riser, Percussion

Each preset includes:
- ADSR Envelope
- Filter (Type, Cutoff, Resonance)
- 3-Band EQ
- Distortion, Compression, Stereo Width

### 5. **Sample Library Management**
- Import sample folders
- Persistent tagging (IndexedDB)
- Filter by genre, BPM, key, instrument
- Waveform previews
- Sample count badges

---

## ⌨️ Keyboard Shortcuts

### Global
- **Space**: Play/Stop
- **Ctrl+Space**: Play from start
- **Ctrl+L**: Toggle loop
- **[**: Set loop start
- **]**: Set loop end
- **Delete**: Remove selected clip
- **Ctrl+D**: Duplicate clip
- **Escape**: Exit full screen

---

## 🎨 Themes

Toggle between **Dark** and **Light** modes using the ☀️/🌙 button in the header.

All components fully support both themes with:
- Consistent color schemes
- Modern gradients and glassmorphism
- Glowing effects for active elements
- Professional shadows and depth

---

## 🔧 Development

### File Structure
- **Original files**: Preserved in `src/` (App.jsx, Sequencer.js, etc.)
- **Enhanced files**: New components with "Enhanced" suffix
- **Demo app**: `AppDemo.jsx` for testing new features

### To Use Enhanced Features
The `main.jsx` is currently set to use `AppDemo.jsx` which shows:
- Arrangement View with loop system
- Modern Mixer with plugin racks
- Theme toggle

### To Use Original App
Edit `src/main.jsx`:
```javascript
import App from './App.jsx'  // Change from AppDemo
```

### Build for Production
```bash
pnpm build
# or
npm run build
```

Output will be in `dist/` folder.

---

## 📦 What's Included

### New Features
✅ 35+ music genres with professional characteristics  
✅ Pattern learning from MIDI/audio samples  
✅ FL Studio-style mixer with dynamic plugins  
✅ Professional arrangement view with loop system  
✅ Audio clip editor (reverse, time-stretch, pitch-shift)  
✅ Sample presets for 808s, kicks, vocals, etc.  
✅ Dark/Light theme system  
✅ Keyboard shortcuts (spacebar play/stop, loop controls)  
✅ Persistent sample library with tagging  
✅ Drag & drop sample assignment  
✅ Waveform visualization  
✅ Real-time VU meters  
✅ Plugin rack system  

### Original Features (Preserved)
✅ MIDI sequencer  
✅ Drum synthesizer  
✅ Instrument synthesizer  
✅ Effects chain  
✅ Audio engine  
✅ Project management  
✅ MIDI recording  
✅ Library manager  

---

## 🎵 Usage Guide

### 1. Arrangement View
- **Add tracks**: Tracks are pre-configured (Drums, Bass, Melody, Chords)
- **Play/Stop**: Press **Spacebar**
- **Set loop region**: Click and drag timeline, or use **[** and **]** keys
- **Toggle loop**: Press **Ctrl+L** or click the **LOOP** button
- **Edit clips**: Right-click for effects menu
- **Zoom**: Use zoom slider in transport controls

### 2. Mixer View
- **Add plugins**: Click **"+"** on any channel
- **Adjust volume**: Drag faders up/down
- **Pan**: Use pan knobs
- **Solo/Mute**: Click S/M buttons
- **Monitor levels**: Watch VU meters

### 3. Sample Management (Coming Soon)
- **Import folders**: Click "Import Folder" button
- **Tag samples**: Add genre, BPM, key, instrument tags
- **Filter**: Use search and tag filters
- **Drag & drop**: Assign samples to drum slots
- **Randomize**: Use randomize button for current folder

---

## 🐛 Troubleshooting

### Port Already in Use
If port 5173 is busy:
```bash
pnpm dev --port 3000
```

### Dependencies Not Installing
Try clearing cache:
```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Audio Not Playing
- Check browser audio permissions
- Ensure AudioContext is resumed (click anywhere on page)
- Check browser console for errors

---

## 📝 Notes

- **Browser Compatibility**: Chrome, Edge, Firefox (latest versions)
- **Audio Engine**: Uses Web Audio API
- **Storage**: IndexedDB for sample library
- **Performance**: Optimized for real-time audio processing

---

## 🚀 Future Enhancements

- VST Plugin Support
- Cloud Storage Integration
- Collaboration Features
- Mobile App Version
- Advanced Automation
- More Plugin Types
- MIDI Export/Import
- Audio Track Bouncing

---

## 🎉 Enjoy Making Music!

**WavLoom Studio v2.0** - Professional Music Production in Your Browser 🎵

For detailed feature documentation, see `FEATURES_IMPLEMENTED.md`

---

## 📄 License

![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

**All Rights Reserved.** Copyright (c) 2026 Mike Weaver. See [`LICENSE`](LICENSE)
for the full terms.

This repository is publicly visible for reference and review only. No license
or permission is granted to use, copy, modify, distribute, or sell the code,
in whole or in part, without the express prior written permission of the
copyright holder. Third-party dependencies remain under their respective
upstream licenses.
