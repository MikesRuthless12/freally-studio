"""Find and fix mismatched backtick/single-quote strings in JSX files."""
import os
import re

BASE = 'src'
fixed_total = 0

for root, dirs, fnames in os.walk(BASE):
    for fn in fnames:
        if not fn.endswith('.jsx'):
            continue
        fpath = os.path.join(root, fn)
        with open(fpath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        changed = False
        for i, line in enumerate(lines):
            original = line

            # Fix pattern: '...text` (single quote open, backtick close)
            # These are corrupted by regex that converted 'string' to `string`
            # but only replaced the opening quote
            # Pattern: 'something` where there's no ${} interpolation needed
            matches = list(re.finditer(r"'([^'`\n]*?)`", line))
            for m in reversed(matches):
                inner = m.group(1)
                # Only fix if there's no ${} interpolation inside
                if '${' not in inner:
                    start, end = m.span()
                    # Replace the backtick with single quote
                    line = line[:end-1] + "'" + line[end:]
                    changed = True

            # Fix pattern: `...text' (backtick open, single quote close)
            matches = list(re.finditer(r"`([^'`\n]*?)'", line))
            for m in reversed(matches):
                inner = m.group(1)
                # Only fix if there's no ${} interpolation inside
                if '${' not in inner:
                    start, end = m.span()
                    # Replace the backtick with single quote
                    line = line[:start] + "'" + line[start+1:]
                    changed = True

            if line != original:
                lines[i] = line
                print(f"  {fpath}:{i+1}: {original.strip()[:80]}")
                print(f"    -> {line.strip()[:80]}")

        if changed:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            fixed_total += 1

print(f"\nFixed files: {fixed_total}")
