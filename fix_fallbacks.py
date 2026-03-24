import os

BASE = 'src'
files = []
for root, dirs, fnames in os.walk(BASE):
    for fn in fnames:
        if fn.endswith('.jsx'):
            files.append(os.path.join(root, fn))

fixed = 0
for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix circular fallbacks
    content = content.replace("accentColors?.accent || ac;", "accentColors?.accent || '#ff6b6b';")
    content = content.replace("accentColors?.secondary || acSec;", "accentColors?.secondary || '#ff9f43';")
    content = content.replace("accentColors?.gradient || acGrad;", "accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';")

    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        fixed += 1
        print(f'Fixed: {fpath}')

print(f'Fixed {fixed} files')
