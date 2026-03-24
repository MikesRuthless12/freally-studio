# WavLoom MIDI Generator - Simplified Edition

A clean, focused MIDI drum pattern generator inspired by Unison Drum Monkey.

---

## 🎯 What's Included

**Only the essentials:**
- ✅ **File Explorer** (left side, FL Studio style)
- ✅ **Drum MIDI Generator** (Drum Monkey style)
- ✅ **Theme Toggle** (Dark/Light mode)
- ✅ **Window Controls** (Maximize/Restore)
- ✅ **Export** (MIDI & Audio, Combined & Stems)

**Removed:**
- ❌ Arrangement view
- ❌ Mixer
- ❌ Plugins
- ❌ All complex DAW features

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install
# or
npm install

# Start dev server
pnpm dev
# or
npm run dev

# Open browser
http://localhost:5173
```

---

## 🎹 Features

### File Explorer (Left Side)
- Import sample folders
- Browse samples with waveforms
- Click to preview samples
- Drag samples to drum slots
- Collapsible folder tree
- Search/filter samples

### Drum Generator (Main Area)

**Top Section - Sample Cards:**
- 8 drum elements (Kick, Clap, Snare, Hats, Toms, Perc)
- Power button for each drum
- Random button - picks random sample from selected folder
- Waveform visualization
- Sample name display

**Grid Section:**
- Click to add/remove notes
- Click and drag to paint notes
- Power, Solo, Mute, Show/Hide for each row
- Clear row button
- 4 or 8 bar patterns
- Beat markers (1.1, 1.2, 2.1, etc.)

**Bottom Section:**
- DRAG & DROP MIDI button
- DRAG & DROP AUDIO button

---

## 🎛️ Controls

### Genre & Length
- **Genre dropdown**: Hip Hop, Trap, Drill, Lo-Fi, House, Techno
- **Length buttons**: 4 BARS or 8 BARS

### Per-Drum Controls
- **Power (●)**: Enable/disable drum in pattern
- **S**: Solo (hear only this drum)
- **M**: Mute (silence this drum)
- **▼/▶**: Show/Hide grid row
- **Random (R)**: Load random sample from selected folder
- **CLR**: Clear all notes in row

### Grid Editing
- **Click cell**: Add/remove note
- **Click + drag**: Paint multiple notes
- **Power off**: Grays out drum (won't play)

---

## 💾 Export Options

Click **DRAG & DROP MIDI** or **DRAG & DROP AUDIO** to see export options:

### MIDI Export
- **MIDI (COMBINED)**: Single .mid file with all drums
- **MIDI (STEMS)**: Separate .mid files for each drum

### Audio Export
- **AUDIO (COMBINED)**: Single .wav file (full mix)
- **AUDIO (STEMS)**: Separate .wav files for each drum

---

## 🎨 Theme Toggle

Click the **☀️ Light** or **🌙 Dark** button in the top right to switch themes.

---

## ⛶ Window Controls

- **Maximize**: Enter fullscreen mode
- **Restore**: Return to normal size
- **Pop-out**: Open in separate window

---

## 🔥 Workflow Example

1. **Import samples**: Click "Add Folder" in file explorer
2. **Select folder**: Choose a folder with kick samples
3. **Random sample**: Click "R" button on Kick card
4. **Generate pattern**: Click cells in grid to create pattern
5. **Repeat**: Do same for Snare, Hats, etc.
6. **Export**: Click "DRAG & DROP MIDI" → Choose format → Download

---

## 📁 File Structure

```
src/
├── AppSimple.jsx              # Main app (simplified)
├── DrumMonkeyGenerator.jsx    # Drum MIDI generator
├── SimpleFileExplorer.jsx     # File browser
├── SampleWaveform.jsx         # Waveform renderer
├── WindowControls.jsx         # Window controls
└── main.jsx                   # Entry point
```

---

## 🎯 Key Differences from Full Version

| Feature | Full Version | Simple Version |
|---------|-------------|----------------|
| Arrangement View | ✅ | ❌ |
| Mixer | ✅ | ❌ |
| Plugins | ✅ | ❌ |
| MIDI Generator | ✅ | ✅ |
| File Explorer | ✅ | ✅ |
| Theme Toggle | ✅ | ✅ |
| Export | ✅ | ✅ |

---

## 🐛 Troubleshooting

### "Sample not loading"
- Make sure you've selected a folder in the file explorer
- Click the "R" (Random) button to load a sample

### "No sound when clicking grid"
- This is a MIDI generator only - export MIDI and use in your DAW
- Or export audio (renders using loaded samples)

### "Can't see waveforms"
- Waveforms appear after loading samples
- Use the Random button or drag samples from file explorer

---

## 🎉 You're Ready!

This simplified version focuses on one thing: **generating professional drum MIDI patterns quickly**.

No distractions, no complex features - just pure MIDI generation!

**Happy producing! 🎵**
