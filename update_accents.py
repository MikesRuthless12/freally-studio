"""Batch update all remaining component files to use dynamic accent colors."""
import re
import os

BASE = 'src'

def add_import(content, relative_path="./accentThemes"):
    marker = f"import {{ hexToRgba }} from '{relative_path}'"
    if marker in content:
        return content
    import_match = list(re.finditer(r"^import .+?;$", content, re.MULTILINE))
    if import_match:
        last_import_end = import_match[-1].end()
        return content[:last_import_end] + f"\nimport {{ hexToRgba }} from '{relative_path}';" + content[last_import_end:]
    return content


def replace_accents(text):
    """Replace all hardcoded accent colors with dynamic references."""
    # Gradients (most specific first)
    for old in [
        "'linear-gradient(135deg, #ff6b6b 0%, #ff9f43 100%)'",
        "'linear-gradient(135deg, #ff6b6b, #ff9f43)'",
        "'linear-gradient(45deg, #ff6b6b, #ff9f43)'",
        "'linear-gradient(90deg, #ff6b6b, #ff9f43)'",
    ]:
        text = text.replace(old, "acGrad")

    # Standalone rgba (no spaces)
    text = re.sub(
        r"'rgba\(255,107,107,([\d.]+)\)'",
        lambda m: f"hexToRgba(ac, {m.group(1)})",
        text,
    )
    # Standalone rgba (with spaces)
    text = re.sub(
        r"'rgba\(255, 107, 107, ([\d.]+)\)'",
        lambda m: f"hexToRgba(ac, {m.group(1)})",
        text,
    )

    # Standalone hex
    text = text.replace("'#ff6b6b'", "ac")
    text = text.replace("'#ff9f43'", "acSec")

    # Compound strings containing #ff6b6b
    text = re.sub(
        r"'([^']*?#ff6b6b[^']*?)'",
        lambda m: "`" + m.group(1).replace("#ff6b6b", "${ac}") + "`",
        text,
    )
    # Compound strings containing #ff9f43
    text = re.sub(
        r"'([^']*?#ff9f43[^']*?)'",
        lambda m: "`" + m.group(1).replace("#ff9f43", "${acSec}") + "`",
        text,
    )
    # Compound rgba
    text = re.sub(
        r"'([^']*?rgba\(255, ?107, ?107[^']*?)'",
        lambda m: "`"
        + re.sub(
            r"rgba\(255, ?107, ?107, ?([\d.]+)\)",
            r"${hexToRgba(ac, \1)}",
            m.group(1),
        )
        + "`",
        text,
    )
    return text


ACCENT_VARS = """
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';
"""


def process_file(fname, is_collab=False):
    fpath = os.path.join(BASE, fname)
    if not os.path.exists(fpath):
        return None

    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    count_before = len(
        re.findall(r"#ff6b6b|#ff9f43|rgba\(255, ?107, ?107", content)
    )
    if count_before == 0:
        return (fname, 0, 0)

    if "const ac = accentColors" in content:
        print(f"  SKIP {fname}: already processed")
        return (fname, count_before, 0)

    # Add import
    rel = "../accentThemes" if is_collab else "./accentThemes"
    content = add_import(content, rel)

    basename = fname.split("/")[-1]
    comp_name = basename.replace(".jsx", "")

    # Try to add accentColors to component props and add convenience vars
    modified = False

    # Pattern 1: const X = ({ props }) => {
    pat = rf"(const {comp_name}\s*=\s*\(\{{)([^}}]+?)(\}}\)\s*=>\s*\{{)"
    m = re.search(pat, content)
    if m:
        if "accentColors" not in m.group(2):
            new_props = m.group(2).rstrip() + ", accentColors"
            old_full = m.group(0)
            new_full = m.group(1) + new_props + m.group(3)
            content = content.replace(old_full, new_full, 1)
        # Find the opening brace position to insert vars
        search_str = m.group(3)[-1]  # should be '{'
        search_from = content.find(m.group(1))
        arrow_pos = content.find("=>", search_from)
        brace_pos = content.find("{", arrow_pos) + 1
        if "const ac = accentColors" not in content:
            content = content[:brace_pos] + ACCENT_VARS + content[brace_pos:]
        modified = True

    if not modified:
        # Pattern 2: export default function X({ props }) {
        pat = rf"(export default function {comp_name}\s*\(\{{)([^}}]+?)(\}}\)\s*\{{)"
        m = re.search(pat, content)
        if m:
            if "accentColors" not in m.group(2):
                new_props = m.group(2).rstrip() + ", accentColors"
                old_full = m.group(0)
                new_full = m.group(1) + new_props + m.group(3)
                content = content.replace(old_full, new_full, 1)
            brace_pos = content.find(m.group(3), content.find(m.group(1))) + len(m.group(3))
            if "const ac = accentColors" not in content:
                content = content[:brace_pos] + ACCENT_VARS + content[brace_pos:]
            modified = True

    if not modified:
        # Pattern 3: forwardRef(({ props }, ref) => {
        pat = r"(forwardRef\(\(\{)([^}]+?)(\},\s*ref\)\s*=>\s*\{)"
        m = re.search(pat, content)
        if m:
            if "accentColors" not in m.group(2):
                new_props = m.group(2).rstrip() + ", accentColors"
                old_full = m.group(0)
                new_full = m.group(1) + new_props + m.group(3)
                content = content.replace(old_full, new_full, 1)
            brace_pos = content.find("{", content.find("=>", content.find(m.group(1)))) + 1
            if "const ac = accentColors" not in content:
                content = content[:brace_pos] + ACCENT_VARS + content[brace_pos:]
            modified = True

    if not modified:
        # Pattern 4: function X({ props }) {
        pat = rf"(function {comp_name}\s*\(\{{)([^}}]+?)(\}}\)\s*\{{)"
        m = re.search(pat, content)
        if m:
            if "accentColors" not in m.group(2):
                new_props = m.group(2).rstrip() + ", accentColors"
                old_full = m.group(0)
                new_full = m.group(1) + new_props + m.group(3)
                content = content.replace(old_full, new_full, 1)
            brace_pos = content.find(m.group(3), content.find(m.group(1))) + len(m.group(3))
            if "const ac = accentColors" not in content:
                content = content[:brace_pos] + ACCENT_VARS + content[brace_pos:]
            modified = True

    if not modified:
        print(f"  WARNING: No component signature found for {fname} — replacing colors only")

    # Handle ArrangementTimeline SECTION_COLORS protection
    if "ArrangementTimeline" in fname:
        sc_start = content.find("const SECTION_COLORS")
        if sc_start >= 0:
            sc_end = content.find("];", sc_start) + 2
            before = content[:sc_start]
            section = content[sc_start:sc_end]
            after = content[sc_end:]
            before = replace_accents(before)
            after = replace_accents(after)
            content = before + section + after
        else:
            content = replace_accents(content)
    else:
        content = replace_accents(content)

    # Fix Knob.jsx default param (color = ac won't work as default)
    if "Knob" in fname:
        content = content.replace("color = ac, size", "color = '#ff6b6b', size")

    # Count remaining
    count_after = len(
        re.findall(r"#ff6b6b|#ff9f43|rgba\(255, ?107, ?107", content)
    )
    # Don't count fallback values in the convenience vars
    fallback_count = (
        content.count("accentColors?.accent || '#ff6b6b'")
        + content.count("accentColors?.secondary || '#ff9f43'")
        + content.count("linear-gradient(135deg, #ff6b6b, #ff9f43)'")
    )
    effective = count_after - fallback_count

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)

    return (fname, count_before, effective)


# Process all files
all_files = [
    ("PianoRollEditor.jsx", False),
    ("ArrangementTimeline.jsx", False),
    ("SuggestionPanel.jsx", False),
    ("FileExplorerPanelEnhanced.jsx", False),
    ("WaveformEditor.jsx", False),
    ("EffectsRack.jsx", False),
    ("HumanizePanel.jsx", False),
    ("MIDIInputPanel.jsx", False),
    ("MixerPanel.jsx", False),
    ("DrumSynthStudio.jsx", False),
    ("InstrumentSynthStudio.jsx", False),
    ("Knob.jsx", False),
    ("SampleSlicerEditor.jsx", False),
    ("WaveformCanvas.jsx", False),
    ("WaveformVisualizer.jsx", False),
    ("EffectVisualizers.jsx", False),
    ("InteractiveCanvas.jsx", False),
    ("SequencerUI.jsx", False),
    ("DrumSampleEditor.jsx", False),
    ("collab/CollabPanel.jsx", True),
    ("collab/LockedOverlay.jsx", True),
    ("collab/Toast.jsx", True),
]

results = []
for fname, is_collab in all_files:
    r = process_file(fname, is_collab)
    if r:
        print(f"  {r[0]}: {r[1]} before -> {r[2]} remaining")
        results.append(r)

print("\n=== SUMMARY ===")
total_remaining = sum(r[2] for r in results if r[2] > 0)
print(f"Total non-fallback remaining: {total_remaining}")
for r in results:
    if r[2] > 0:
        print(f"  {r[0]}: {r[2]} remaining")
